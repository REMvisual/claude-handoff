// Pure helpers for the compact-handoff mod: no `$`, so the tests can call them directly.
import type { Mode } from '../types'

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
    `compact-handoff: \`${handoff}\` has ${lines} lines; the ${floor.pass} pass minimum is ${floor.min} ` +
    `(context was ${Math.round(tokens / 1000)}k tokens). The conversation is deleted after this, so the mining is not finished. ` +
    'Read `references/mining-deep-chunked.md` if you have not, then go through the conversation early, middle and late ' +
    'for decisions, numbers, failed approaches, file paths and user feedback the file is missing, and Edit them in. ' +
    'Extract, do not pad. Then end your turn with the COMPACT-HANDOFF-READY line again.'
  )
}

/** The model's own call to a handoff skill, by the Skill tool's `skill` value. */
export function isHandoffSkill(skill: string): boolean {
  return /^\/?(?:[\w-]+:)?(handoff|handoffplan)$/.test(skill.trim())
}

export const SKILL_DENIED =
  'compact-handoff: a handoff starts when the user asks for one. Do not write a handoff file yourself. ' +
  'Tell the user the work is at a good point for a handoff and that they can type /compact-handoff ' +
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
