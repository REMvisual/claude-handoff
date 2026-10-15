// compact-handoff: /compact-handoff and /compact-handoffplan run the handoff skills in compact mode,
// then replace the conversation with the handoff and continue in the same session.
//
// Order of events (each step is the one the engine allows; see the README):
//   command  -> timer -> $.command.run(handoff|handoffplan, "compact-mode ...")   (no prompt from inside a command hook)
//   tool.call Write/Edit records the handoff/plan files the skill writes
//   turn.complete -> verify the files on disk -> queue /compact-handoff-go       (no compaction while a turn runs)
//   compact-handoff-go -> timer -> $.session.compact(marker + stub)              (answered by compact-handoff-answer;
//                                                                                 a plugin cannot answer its own compaction)
//   -> $.prompt.submit(the skill's own paste prompt)
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Mode, Run } from '../types'
import {
  buildInstructions,
  classifyPath,
  extractPastePrompt,
  fallbackPrompt,
  parseSentinel,
  resolvePath,
  samePath,
  stubText,
} from './logic'

const runAtom = atom({ plugin: 'compact-handoff', key: 'run' } as const, null as Run | null)
const nudgedAtom = atom({ plugin: 'compact-handoff', key: 'nudged' } as const, false)

const GO = 'compact-handoff-go'
const NUDGE_PERCENT = 70
const MAX_COMPACT_TRIES = 40

function say($: EngineInterface, text: string) {
  $.ui.toast(`compact-handoff: ${text}`)
}

async function abort($: EngineInterface, why: string) {
  await update($, runAtom, () => null)
  say($, `${why}. Context unchanged.`)
}

async function start($: EngineInterface, mode: Mode, args: string) {
  if (args.trim() === 'cancel') {
    await update($, runAtom, () => null)
    return { text: 'cancelled.' }
  }
  const running = await read($, runAtom)
  if (running) {
    return { text: 'a run is already in progress (`/compact-handoff cancel` to drop it).' }
  }
  await update($, runAtom, () => ({ mode, stage: 'handoff' as const, startedAt: Date.now(), files: [] }))
  const skill = mode === 'plan' ? 'handoffplan' : 'handoff'
  const skillArgs = `compact-mode ${args}`.trim()
  // A prompt or command raised from inside this hook would wait on the turn the hook holds.
  $.clock.after(100, () => runSkill($, skill, skillArgs))
  return { text: `Running /${skill} in compact mode. The conversation is replaced when it finishes.` }
}

async function runSkill($: EngineInterface, skill: string, args: string) {
  try {
    await $.command.run({ command: skill, args })
  } catch (err) {
    try {
      await $.prompt.submit({ text: `Run the ${skill} skill with these arguments: ${args}` })
    } catch (err2) {
      await abort($, `could not start /${skill} (${String(err2 ?? err)})`)
    }
  }
}

async function finishHandoff($: EngineInterface, reason: string, text: string) {
  const run = await read($, runAtom)
  if (!run || run.stage !== 'handoff') return
  if (reason !== 'answer') return abort($, `the handoff turn ended early (${reason})`)

  const sentinel = parseSentinel(text)
  if (sentinel && !sentinel.ok) return abort($, `the skill reported: ${sentinel.reason}`)

  const reported = sentinel?.ok ? sentinel.files : []
  const pick = (kind: 'HANDOFF' | 'PLAN') =>
    reported.find(f => classifyPath(f) === kind) ?? [...run.files].reverse().find(f => classifyPath(f) === kind)
  const handoff = pick('HANDOFF')
  const plan = run.mode === 'plan' ? pick('PLAN') : undefined
  if (!handoff) return abort($, 'no handoff file was written')
  if (run.mode === 'plan' && !plan) return abort($, 'no plan file was written')
  if (sentinel?.ok && run.files.length && !run.files.some(f => samePath(f, handoff))) {
    say($, `the skill named ${handoff}, which no Write/Edit in this run touched; checking it on disk anyway`)
  }

  const cwd = await $.session.cwd()
  for (const file of [handoff, plan].filter((f): f is string => !!f)) {
    let content = ''
    try {
      content = await $.fs.read(resolvePath(cwd, file))
    } catch {
      return abort($, `cannot read ${file}`)
    }
    if (content.trim().length < 200) return abort($, `${file} looks empty`)
  }

  const pastePrompt = extractPastePrompt(text) ?? fallbackPrompt(run.mode, handoff, plan)
  await update($, runAtom, r => (r ? { ...r, stage: 'compacting' as const, handoff, plan, pastePrompt } : r))
  // Compaction is refused while a turn runs; a queued command runs once the session is idle.
  $.command.run({ command: GO }).catch(err => abort($, `could not queue the compaction (${String(err)})`))
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
      if (attempt >= MAX_COMPACT_TRIES) return abort($, `the compaction kept being refused (${String(err)})`)
      $.clock.after(500, () => compactLoop($, attempt + 1))
      return
    }
    if (result.skip !== undefined) return abort($, `the compaction was skipped: ${result.skip}`)
    if (result.usage) say($, 'compact-handoff-answer is not installed, so the engine summarized instead')
    await update($, runAtom, () => null)
    await update($, nudgedAtom, () => false)
    try {
      await $.prompt.submit({ text: run.pastePrompt ?? fallbackPrompt(run.mode, run.handoff, run.plan), asUser: true })
    } catch (err) {
      say($, `context replaced, but the continue-prompt could not be sent (${String(err)}). Paste it from the handoff.`)
    }
  })()
}

async function nudge($: EngineInterface) {
  if (await read($, nudgedAtom)) return
  const usage = await $.session.usage()
  if ((usage.context.percent ?? 0) < NUDGE_PERCENT) return
  await update($, nudgedAtom, () => true)
  say($, `context at ${Math.round(usage.context.percent ?? 0)}%. /compact-handoff is recommended.`)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'compact-handoff',
      description: 'Run /handoff, then replace the conversation with it and continue (experimental)',
    })
    await $.command.register({
      name: 'compact-handoffplan',
      description: 'Run /handoffplan, then replace the conversation with it and start Phase 1 (experimental)',
    })
    await $.command.register({ name: GO, description: 'Internal step of /compact-handoff' })
    return next(e)
  })

  on('command.run', { command: 'compact-handoff' }, async ($, e) => start($, 'resume', e.args))
  on('command.run', { command: 'compact-handoffplan' }, async ($, e) => start($, 'plan', e.args))
  on('command.run', { command: GO }, async $ => {
    const run = await read($, runAtom)
    if (!run || run.stage !== 'compacting') return { text: 'nothing to compact.' }
    // Compacting from inside this hook is refused too; a timer runs after it returns.
    $.clock.after(300, () => compactLoop($, 0))
    return { text: 'replacing the conversation with the handoff.' }
  }).catch(() => ({ text: 'internal step failed. Context unchanged.' }))

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const res = await next(e)
    if (!e.agentId && !res.deny && !res.isError && classifyPath(e.file_path)) {
      await update($, runAtom, r =>
        r && r.stage === 'handoff' && !r.files.includes(e.file_path) ? { ...r, files: [...r.files, e.file_path] } : r,
      )
    }
    return res
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const res = await next(e)
    if (!e.agentId && !res.deny && !res.isError && classifyPath(e.file_path)) {
      await update($, runAtom, r =>
        r && r.stage === 'handoff' && !r.files.includes(e.file_path) ? { ...r, files: [...r.files, e.file_path] } : r,
      )
    }
    return res
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const res = await next(e)
    if (e.agentId) return res
    const run = await read($, runAtom)
    if (run) await finishHandoff($, e.reason, res.text)
    else await nudge($)
    return res
  }).catch(($, e, next) => next(e))
}
