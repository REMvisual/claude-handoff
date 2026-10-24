// compact-handoff: /compact-handoff and /compact-handoffplan run the handoff skills in compact mode,
// then replace the conversation with the handoff and continue in the same session.
//
// Order of events (each step is the one the engine allows; see the README):
//   command  -> timer -> $.command.run(handoff|handoffplan, "compact-mode context=Nk ...")  (no prompt from inside a command hook)
//   tool.call Write/Edit records the handoff/plan files the skill writes; Read/Write/Edit move the progress
//   turn.complete -> verify the files on disk and the handoff's line floor          (under it: ask once for the rest)
//                 -> queue /compact-handoff-go                                   (no compaction while a turn runs)
//   compact-handoff-go -> timer -> $.session.compact(marker + stub)              (answered by compact-handoff-answer;
//                                                                                 a plugin cannot answer its own compaction)
//   -> $.prompt.submit(the skill's own paste prompt)
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Mode, Progress, Run } from '../types'
import {
  advance,
  buildInstructions,
  classifyPath,
  contextArg,
  countLines,
  extractPastePrompt,
  fallbackPrompt,
  isHandoffSkill,
  lineFloor,
  parseChain,
  parseSentinel,
  progressBar,
  readingProgress,
  resolvePath,
  samePath,
  shortPrompt,
  SKILL_DENIED,
  stubText,
  writingProgress,
} from './logic'

const runAtom = atom({ plugin: 'compact-handoff', key: 'run' } as const, null as Run | null)
const nudgedAtom = atom({ plugin: 'compact-handoff', key: 'nudged' } as const, false)
// True for the rest of a turn in which the user asked for a handoff (in words or with /handoff, /handoffplan).
const askedAtom = atom({ plugin: 'compact-handoff', key: 'askedForHandoff' } as const, false)
const progressAtom = atom({ plugin: 'compact-handoff', key: 'progress' } as const, null as Progress | null)

const GO = 'compact-handoff-go'
const NUDGE_PERCENT = 70
const MAX_COMPACT_TRIES = 40
const DONE_SHOWN_MS = 8000

function say($: EngineInterface, text: string) {
  $.ui.toast(`Handoff: ${text}`)
}

async function setProgress($: EngineInterface, next: Progress) {
  await update($, progressAtom, prev => advance(prev, next))
}

async function abort($: EngineInterface, why: string) {
  await update($, runAtom, () => null)
  await update($, progressAtom, () => null)
  say($, `${why}. The conversation was not changed.`)
}

async function start($: EngineInterface, mode: Mode, args: string) {
  args = (args ?? '').trim()
  if (args === 'cancel') {
    await update($, runAtom, () => null)
    await update($, progressAtom, () => null)
    return { text: 'Cancelled. The conversation was not changed.' }
  }
  const running = await read($, runAtom)
  if (running) {
    return { text: 'A handoff is already running. `/compact-handoff cancel` drops it.' }
  }
  const usage = await $.session.usage().catch(() => null)
  const tokens = usage?.context.tokens
  await update($, runAtom, () => ({
    mode,
    stage: 'handoff' as const,
    startedAt: Date.now(),
    files: [],
    contextTokens: tokens,
    window: usage?.context.window,
  }))
  await update($, progressAtom, () => ({ percent: 5, step: 'Starting' }))
  const skill = mode === 'plan' ? 'handoffplan' : 'handoff'
  // The measured size, so the skill picks its mining pass from a number rather than a guess.
  const skillArgs = ['compact-mode', contextArg(tokens), args].filter(Boolean).join(' ')
  // A prompt or command raised from inside this hook would wait on the turn the hook holds.
  $.clock.after(100, () => runSkill($, skill, skillArgs))
  const what = mode === 'plan' ? 'the handoff and the plan' : 'the handoff'
  return { text: `Writing ${what}. When it is done, it replaces this conversation and work carries on from it.` }
}

async function runSkill($: EngineInterface, skill: string, args: string) {
  try {
    await $.command.run({ command: skill, args })
  } catch (err) {
    try {
      await $.prompt.submit({ text: `Run the ${skill} skill with these arguments: ${args}` })
    } catch (err2) {
      await abort($, `/${skill} could not start (${String(err2 ?? err)})`)
    }
  }
}

/** After a Write/Edit of a handoff file in a run: record it and move the progress by its length. */
async function trackFile($: EngineInterface, path: string) {
  const kind = classifyPath(path)
  const run = await read($, runAtom)
  if (!kind || !run || run.stage !== 'handoff') return
  if (!run.files.includes(path)) await update($, runAtom, r => (r ? { ...r, files: [...r.files, path] } : r))
  if (kind === 'PLAN') return setProgress($, { percent: 72, step: 'Writing the plan' })
  let content = ''
  try {
    content = await $.fs.read(resolvePath(await $.session.cwd(), path))
  } catch {
    return
  }
  const floor = lineFloor(run.contextTokens ?? 0, run.window ?? 0)
  await setProgress($, writingProgress(countLines(content), floor, !!run.retried))
}

async function finishHandoff($: EngineInterface, reason: string, text: string) {
  const run = await read($, runAtom)
  if (!run || run.stage !== 'handoff') return
  if (reason !== 'answer') return abort($, `the handoff stopped early (${reason})`)

  const sentinel = parseSentinel(text)
  if (sentinel && !sentinel.ok) return abort($, `the skill could not finish: ${sentinel.reason}`)

  const reported = sentinel?.ok ? sentinel.files : []
  const pick = (kind: 'HANDOFF' | 'PLAN') =>
    reported.find(f => classifyPath(f) === kind) ?? [...run.files].reverse().find(f => classifyPath(f) === kind)
  const handoff = pick('HANDOFF')
  const plan = run.mode === 'plan' ? pick('PLAN') : undefined
  if (!handoff) return abort($, 'no handoff file was written')
  if (run.mode === 'plan' && !plan) return abort($, 'no plan file was written')
  if (sentinel?.ok && run.files.length && !run.files.some(f => samePath(f, handoff))) {
    say($, `the skill named ${handoff}, which this run did not write; checking it on disk anyway`)
  }

  const cwd = await $.session.cwd()
  let chain: string | null = null
  let lines = 0
  for (const file of [handoff, plan].filter((f): f is string => !!f)) {
    let content = ''
    try {
      content = await $.fs.read(resolvePath(cwd, file))
    } catch {
      return abort($, `${file} could not be read`)
    }
    if (content.trim().length < 200) return abort($, `${file} is empty`)
    if (file === handoff) {
      chain = parseChain(content)
      lines = countLines(content)
    }
  }

  // The conversation is deleted next, so a thin handoff is refused rather than compacted.
  const tokens = run.contextTokens ?? 0
  const floor = lineFloor(tokens, run.window ?? 0)
  if (lines < floor.min) {
    if (run.retried) {
      return abort($, `the handoff is still too short (${lines} of ${floor.min} lines). Run /handoff to finish it by hand`)
    }
    const firstPrompt = extractPastePrompt(text)
    await update($, runAtom, r => (r ? { ...r, retried: true, pastePrompt: firstPrompt ?? r.pastePrompt } : r))
    await setProgress($, writingProgress(lines, floor, true))
    say($, `the handoff has ${lines} of ${floor.min} lines, so it is not finished. Asking for the missing detail.`)
    $.clock.after(100, () => {
      $.prompt
        .submit({ text: shortPrompt(handoff, lines, floor, tokens) })
        .catch(err => abort($, `could not ask for the missing detail (${String(err)})`))
    })
    return
  }

  const pastePrompt = extractPastePrompt(text) ?? run.pastePrompt ?? fallbackPrompt(run.mode, handoff, plan, chain)
  await update($, runAtom, r => (r ? { ...r, stage: 'compacting' as const, handoff, plan, pastePrompt } : r))
  await setProgress($, { percent: 90, step: 'Replacing the conversation', detail: `${lines} lines` })
  // Compaction is refused while a turn runs; a queued command runs once the session is idle.
  $.command.run({ command: GO }).catch(err => abort($, `could not start the replacement (${String(err)})`))
}

function compactLoop($: EngineInterface, attempt: number) {
  void (async () => {
    const run = await read($, runAtom)
    if (!run || run.stage !== 'compacting' || !run.handoff) return
    const instructions = buildInstructions(stubText(run.mode, run.handoff, run.plan))
    let result
    try {
      result = await $.session.compact({ instructions })
    } catch (err) {
      if (attempt >= MAX_COMPACT_TRIES) return abort($, `Claude Code kept refusing the replacement (${String(err)})`)
      $.clock.after(500, () => compactLoop($, attempt + 1))
      return
    }
    if (result.skip !== undefined) return abort($, `the replacement was skipped: ${result.skip}`)
    if (result.usage) say($, 'compact-handoff-answer is not installed, so Claude Code summarized the conversation instead')
    await update($, runAtom, () => null)
    await update($, nudgedAtom, () => false)
    await update($, progressAtom, () => ({ percent: 100, step: 'Done', detail: 'continuing from the handoff' }))
    $.clock.after(DONE_SHOWN_MS, () => void update($, progressAtom, p => (p?.percent === 100 ? null : p)))
    try {
      await $.prompt.submit({ text: run.pastePrompt ?? fallbackPrompt(run.mode, run.handoff, run.plan), asUser: true })
    } catch (err) {
      say($, `the conversation was replaced, but the next prompt could not be sent (${String(err)}). Paste it from the handoff.`)
    }
  })()
}

async function nudge($: EngineInterface) {
  if (await read($, nudgedAtom)) return
  const usage = await $.session.usage()
  if ((usage.context.percent ?? 0) < NUDGE_PERCENT) return
  await update($, nudgedAtom, () => true)
  say($, `context is at ${Math.round(usage.context.percent ?? 0)}%. A good point for /compact-handoff.`)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'compact-handoff',
      description: 'Write a handoff, then replace the conversation with it and carry on (experimental)',
    })
    await $.command.register({
      name: 'compact-handoffplan',
      description: 'Write a handoff and a plan, then replace the conversation and start Phase 1 (experimental)',
    })
    await $.command.register({ name: GO, description: 'Internal step of /compact-handoff' })
    return next(e)
  })

  // The internal step stays runnable but out of the typeahead and /help.
  on('command.describe', { command: GO }, async ($, e, next) => ({ ...(await next(e)), isHidden: true }))

  on('command.run', { command: 'compact-handoff' }, async ($, e) => start($, 'resume', e.args))
  on('command.run', { command: 'compact-handoffplan' }, async ($, e) => start($, 'plan', e.args))
  on('command.run', { command: GO }, async $ => {
    const run = await read($, runAtom)
    if (!run || run.stage !== 'compacting') return { text: 'Nothing to replace.' }
    // Compacting from inside this hook is refused too; a timer runs after it returns.
    $.clock.after(300, () => compactLoop($, 0))
    return { text: 'Replacing the conversation with the handoff…' }
  }).catch(() => ({ text: 'The replacement step failed. The conversation was not changed.' }))

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const res = await next(e)
    if (!e.agentId && !res.deny && !res.isError) await trackFile($, e.file_path)
    return res
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const res = await next(e)
    if (!e.agentId && !res.deny && !res.isError) await trackFile($, e.file_path)
    return res
  }).catch(($, e, next) => next(e))

  // The skill's references mark its steps: mining, checking, closing.
  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const res = await next(e)
    const run = await read($, runAtom)
    if (!e.agentId && run?.stage === 'handoff') {
      const written = run.files.some(f => classifyPath(f) === 'HANDOFF')
      const step = readingProgress(e.file_path, written)
      await setProgress($, step ?? { percent: 10, step: 'Reading the session' })
    }
    return res
  }).catch(($, e, next) => next(e))

  // The model may not start a handoff on its own: the user picks /compact-handoff or /handoff.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    if (!isHandoffSkill(e.skill) || (await read($, runAtom)) || (await read($, askedAtom))) return next(e)
    return { deny: SKILL_DENIED }
  }).catch(($, e, next) => next(e))

  on('prompt.submit', async ($, e, next) => {
    if (/hand-?off/i.test(e.text ?? '')) await update($, askedAtom, () => true)
    return next(e)
  }).catch(($, e, next) => next(e))

  // /handoff, /handoffplan typed by the user; /handoffplan then runs /handoff through the Skill tool.
  on('skill.prompt', async ($, e, next) => {
    if (isHandoffSkill(e.skill)) await update($, askedAtom, () => true)
    return next(e)
  }).catch(($, e, next) => next(e))

  // The spinner line names the step while the handoff turn runs.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const p = await read($, progressAtom)
    if (!p || p.percent >= 100) return next(e)
    return next({ ...e, props: { ...e.props, message: `Handoff ${p.percent}% · ${p.step}` } })
  }).catch(($, e, next) => next(e))

  // A bar above the prompt for the whole run, until a few seconds after it is done.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const p = await read($, progressAtom)
    if (!p || e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text bold>Handoff </Text>
        <Text color={p.percent >= 100 ? 'green' : undefined}>{progressBar(p.percent)}</Text>
        <Text bold> {p.percent}% </Text>
        <Text>{p.step}</Text>
        {p.detail ? <Text dimColor> · {p.detail}</Text> : null}
      </Box>
    )
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const res = await next(e)
    if (e.agentId) return res
    await update($, askedAtom, () => false)
    const run = await read($, runAtom)
    if (run) await finishHandoff($, e.reason, res.text)
    else await nudge($)
    return res
  }).catch(($, e, next) => next(e))
}
