// Pure helpers for the compact-handoff mod: no `$`, so the tests can call them directly.
import type { Mode, Progress } from '../types'

/**
 * First line of the compaction instructions. compact-handoff-answer answers only a
 * compaction whose instructions start with it, and returns the text after it.
 */
export const MARKER = 'compact-handoff:v1'

const HANDOFF_FILE = /(?:^|[\\/])(?:plans|\.claude)[\\/]handoffs[\\/](HANDOFF|PLAN)_[^\\/]*\.md$/

/** `HANDOFF` or `PLAN` for a file the handoff skills write, else null. */
export function classifyPath(path: string): 'HANDOFF' | 'PLAN' | null {
  const m = HANDOFF_FILE.exec(path)
  if (!m) return null
  return m[1] === 'PLAN' ? 'PLAN' : 'HANDOFF'
}

export type Sentinel = { ok: true; files: string[] } | { ok: false; reason: string }

/** Reads the skill's last `COMPACT-HANDOFF-READY:` / `COMPACT-HANDOFF-FAILED:` line; null when there is none. */
export function parseSentinel(text: string): Sentinel | null {
  const lines = text.split(/\r?\n/).map(l => l.trim().replace(/^`+|`+$/g, '').trim())
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i] ?? ''
    const ready = /^COMPACT-HANDOFF-READY:\s*(.+)$/.exec(line)
    if (ready) {
      const files = (ready[1] ?? '')
        .split('|')
        .map(f => f.trim().replace(/^`+|`+$/g, ''))
        .filter(Boolean)
      return { ok: true, files }
    }
    const failed = /^COMPACT-HANDOFF-FAILED:\s*(.*)$/.exec(line)
    if (failed) return { ok: false, reason: failed[1] || 'no reason given' }
  }
  return null
}

/** The prompt between the dashes after `PASTE THIS INTO YOUR NEXT SESSION:`, or null. */
export function extractPastePrompt(text: string): string | null {
  const lines = text.split(/\r?\n/)
  const head = lines.findIndex(l => l.includes('PASTE THIS INTO YOUR NEXT SESSION:'))
  if (head < 0) return null
  const isRule = (l: string) => /^\s*-{10,}\s*$/.test(l)
  let start = head + 1
  if (isRule(lines[start] ?? '')) start++
  const end = lines.findIndex((l, i) => i >= start && isRule(l))
  if (end < 0) return null
  const body = lines
    .slice(start, end)
    .map(l => l.replace(/^ {3}/, ''))
    .join('\n')
    .trim()
  return body || null
}

/** The handoff's chain as "seq N, tag", from its `**Chain:** \`tag\` seq \`N\`` header line. */
export function parseChain(content: string): string | null {
  const m = /^\*\*Chain:\*\*\s*`([^`]+)`\s*seq\s*`?(\d+)`?/m.exec(content)
  return m ? `seq ${m[2]}, ${m[1]}` : null
}

export type Floor = { pass: 'Quick' | 'Deep' | 'Chunked'; min: number }

/**
 * The handoff skill's line minimum for the mining pass the context size calls for.
 * Quick gets the light-session floor, so a short session is never refused.
 */
export function lineFloor(tokens: number, window: number): Floor {
  if (tokens >= 500_000) return { pass: 'Chunked', min: 500 }
  if (tokens >= 100_000) return { pass: 'Deep', min: 300 }
  return { pass: 'Quick', min: window >= 1_000_000 ? 120 : 80 }
}

export function countLines(content: string): number {
  const body = content.replace(/\s+$/, '')
  return body ? body.split(/\r?\n/).length : 0
}

/** Sent once when the handoff is under its floor: finish mining, then report again. */
export function shortPrompt(handoff: string, lines: number, floor: Floor, tokens: number): string {
  return (
    `The handoff is too short to replace this conversation: ${lines} lines, and a ${kTokens(tokens)} session ` +
    `needs at least ${floor.min} (${floor.pass} pass).\n\n` +
    `Go back through the early, middle and late parts of the session and add what \`${handoff}\` is missing: ` +
    'decisions, numbers, failed approaches, file paths, user feedback. Read `references/mining-deep-chunked.md` first ' +
    'if you have not. Add real detail, not padding. Then print the Length check again and end with the ' +
    'COMPACT-HANDOFF-READY line.'
  )
}

/** 948k */
export function k(tokens: number): string {
  return `${Math.round(tokens / 1000)}k`
}

export function kTokens(tokens: number): string {
  return `${Math.round(tokens / 1000)}k-token`
}

/** The context size the skill picks its mining pass from, as a `compact-mode` argument. */
export function contextArg(tokens: number | undefined): string {
  return tokens ? `context=${Math.round(tokens / 1000)}k` : ''
}

/**
 * Context a run needs between its start and Claude Code's own auto-compact. Two measured Chunked runs
 * grew it by 45k and 62k (the skill's references, the mining reads, the file and its checks).
 */
export function roomNeeded(tokens: number): number {
  if (tokens >= 500_000) return 80_000
  if (tokens >= 100_000) return 60_000
  return 30_000
}

/** 0 none, 1 early (a handoff has 120k to spare), 2 late (20k to spare), 3 out (less than it needs). */
export type RoomLevel = 0 | 1 | 2 | 3

export function roomLevel(tokens: number, left: number): RoomLevel {
  if (tokens < 100_000) return 0
  const needed = roomNeeded(tokens)
  if (left < needed) return 3
  if (left < needed + 20_000) return 2
  if (left < needed + 120_000) return 1
  return 0
}

/** The toast for a room level, once per level until the next compaction. */
export function roomWarning(level: RoomLevel, tokens: number, left: number): string | null {
  const needed = k(roomNeeded(tokens))
  if (level === 1) return `about ${k(left)} of context left before Claude Code compacts on its own. A handoff needs about ${needed}: a good point for /compact-handoff.`
  if (level === 2) return `only ${k(left)} of context left before Claude Code compacts on its own. Run /compact-handoff now: with under ${needed} left it cannot start.`
  if (level === 3) return `${k(left)} of context left before Claude Code compacts on its own, less than the ${needed} a handoff needs. /compact-handoff cannot run now; Claude Code's own /compact is what is left.`
  return null
}

/** Why /compact-handoff did not start: Claude Code would compact before the handoff was written. */
export function noRoomText(tokens: number, limit: number): string {
  return (
    `Not started. The context is ${k(tokens)} and Claude Code compacts on its own at ${k(limit)}. ` +
    `A handoff this size needs about ${k(roomNeeded(tokens))} of room, so Claude Code would compact before it was written and nothing would be saved. ` +
    `Claude Code's own /compact is what is left. Next time, start /compact-handoff when the room warning shows.`
  )
}

/** Told to Claude Code's summarizer when its own compaction cuts a run off. */
export const CUT_OFF_NOTE =
  'A /compact-handoff run was in progress when this compaction ran, and it was cut off before the handoff file was finished. ' +
  'Say so in the summary, so the next turn tells the user that no handoff was written.'

export function progressBar(percent: number, width = 20): string {
  const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

/** 25-70% while the first pass grows toward its floor; 80-88% while missing detail is added. */
export function writingProgress(lines: number, floor: Floor, addingDetail: boolean): Progress {
  const share = Math.min(lines / floor.min, 1)
  const detail = `${lines} of ${floor.min} lines`
  return addingDetail
    ? { percent: 80 + Math.round(8 * share), step: 'Adding missing detail', detail }
    : { percent: 25 + Math.round(45 * share), step: 'Writing the handoff', detail }
}

/** The step a skill reference marks. Checking and closing count only once the handoff exists. */
export function readingProgress(path: string, written: boolean): Progress | null {
  const name = (path.replace(/\\/g, '/').split('/').pop() ?? '').toLowerCase()
  if (name === 'mining-deep-chunked.md' || name === 'output-template.md') return { percent: 20, step: 'Mining the session' }
  if (!written) return null
  if (name === 'validation.md') return { percent: 75, step: 'Checking the handoff' }
  if (name === 'close-session.md') return { percent: 80, step: 'Closing the session' }
  return null
}

/** Progress only moves forward; a lower reading keeps the step and takes the new detail. */
export function advance(prev: Progress | null, next: Progress): Progress {
  if (!prev || next.percent >= prev.percent) return next
  return next.detail ? { ...prev, detail: next.detail } : prev
}

/** The model's own call to a handoff skill, by the Skill tool's `skill` value. */
export function isHandoffSkill(skill: string): boolean {
  return /^\/?(?:[\w-]+:)?(handoff|handoffplan)$/.test(skill.trim())
}

export const SKILL_DENIED =
  'A handoff starts when the user asks for one, so this call was refused. Do not write a handoff file yourself. ' +
  'Tell the user the work is at a good point for a handoff, and that they can type /compact-handoff ' +
  '(writes the handoff, then replaces the conversation with it) or /handoff (writes it and keeps the conversation).'

/** Used only when the skill's own paste prompt could not be extracted. */
export function fallbackPrompt(mode: Mode, handoff: string, plan?: string, chain?: string | null): string {
  const tag = chain ? ` (${chain})` : ''
  if (mode === 'plan' && plan) {
    return `Read \`${plan}\` and \`${handoff}\`${tag}. Execute the plan starting at Phase 1: claim its bead, read the Quick Start files, then start coding Phase 1's first concrete action.`
  }
  return (
    `Read \`${handoff}\`${tag} and continue from "Where We're Going". Check \`bd list --status=in_progress\` for active work.\n\n` +
    'Before starting work, summarize the goal, current state and what was tried; name the bead(s) you will claim; ' +
    'say what you will verify first; then wait for my go-ahead before executing.'
  )
}

/** The one message the conversation is replaced with. */
export function stubText(mode: Mode, handoff: string, plan?: string): string {
  const files = plan ? `Handoff: \`${handoff}\`. Plan: \`${plan}\`.` : `Handoff: \`${handoff}\`.`
  return (
    `The conversation was replaced by compact-handoff (${mode} mode) after a full handoff. ${files} ` +
    'Everything earlier in this session is in those files; the next message says what to do.'
  )
}

/**
 * The compaction's instructions: the marker line, then the stub. Without the answering
 * plugin the engine's summarizer reads them instead, so they must make sense to it too.
 */
export function buildInstructions(stub: string): string {
  return `${MARKER}\n${stub}`
}

/** Makes a skill-reported relative path absolute against the session's directory. */
export function resolvePath(cwd: string, path: string): string {
  if (/^([a-zA-Z]:[\\/]|[\\/])/.test(path)) return path
  const sep = cwd.includes('\\') ? '\\' : '/'
  return `${cwd.replace(/[\\/]+$/, '')}${sep}${path.replace(/^\.[\\/]/, '')}`
}

/** Same file, whatever the separators or case of a Windows path. */
export function samePath(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase()
  return norm(a) === norm(b) || norm(a).endsWith('/' + norm(b)) || norm(b).endsWith('/' + norm(a))
}
