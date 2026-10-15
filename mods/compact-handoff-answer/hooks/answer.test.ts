import { expect, test } from 'claude-code/testing'

import { answerFor, MARKER } from './answer'

test('answers a marked main-loop compaction with the text after the marker', () => {
  expect(answerFor({ instructions: `${MARKER}\nHandoff: plans/handoffs/HANDOFF_x.md` })).toBe(
    'Handoff: plans/handoffs/HANDOFF_x.md',
  )
})

test('leaves unmarked, empty, subagent and marker-only compactions alone', () => {
  expect(answerFor({})).toBe(null)
  expect(answerFor({ instructions: 'keep the API notes' })).toBe(null)
  expect(answerFor({ instructions: `${MARKER}\nstub`, agentId: 'a1' })).toBe(null)
  expect(answerFor({ instructions: `${MARKER}\n   ` })).toBe(null)
  expect(answerFor({ instructions: `xx ${MARKER}\nstub` })).toBe(null)
})

test('installs the stub through the engine and never reaches core', async ($, on) => {
  on('session.compact', () => ({ messages: [{ role: 'user' as const, text: 'CORE SUMMARY', toolUses: [] }] }))
  const marked = await $.session.compact({ trigger: 'plugin', messages: [], instructions: `${MARKER}\nSTUB` })
  expect(marked.messages?.map(m => m.text)).toEqual(['STUB'])
  const plain = await $.session.compact({ trigger: 'plugin', messages: [], instructions: 'summarize please' })
  expect(plain.messages?.map(m => m.text)).toEqual(['CORE SUMMARY'])
})
