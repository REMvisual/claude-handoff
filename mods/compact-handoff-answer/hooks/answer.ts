// The whole protocol with compact-handoff: instructions = MARKER line + the message to install.
export const MARKER = 'compact-handoff:v1'

/** The message to install for this compaction, or null to leave it to the engine. */
export function answerFor(e: { agentId?: string; instructions?: string }): string | null {
  if (e.agentId || !e.instructions) return null
  const [first = '', ...rest] =e.instructions.split('\n')
  if (first.trim() !== MARKER) return null
  const body = rest.join('\n').trim()
  return body || null
}
