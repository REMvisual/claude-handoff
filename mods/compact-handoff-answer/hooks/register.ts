// compact-handoff-answer: answers the compactions compact-handoff starts. The engine skips a
// plugin's own hooks on an event that plugin raised, so the answer has to come from a second plugin.
import type { Register } from 'claude-code'

import { answerFor } from './answer'

export const register: Register = on => {
  on('session.compact', async ($, e, next) => {
    const text = answerFor(e)
    if (text === null) return next(e)
    return { messages: [{ role: 'user', text, toolUses: [] }] }
  }).catch(($, e, next) => next(e))
}
