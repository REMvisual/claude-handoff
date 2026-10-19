import { expect, mock, test } from 'claude-code/testing'

import {
  buildInstructions,
  classifyPath,
  extractPastePrompt,
  fallbackPrompt,
  MARKER,
  parseChain,
  parseSentinel,
  resolvePath,
  samePath,
  stubText,
} from './logic'

test('classifies handoff and plan files under either folder and separator', () => {
  expect(classifyPath('plans/handoffs/HANDOFF_x_slug_2026-10-15.md')).toBe('HANDOFF')
  expect(classifyPath('C:\\repo\\plans\\handoffs\\PLAN_x_slug_2026-10-15.md')).toBe('PLAN')
  expect(classifyPath('/home/u/repo/.claude/handoffs/HANDOFF_slug_2026-10-15.md')).toBe('HANDOFF')
  expect(classifyPath('plans/handoffs/archive/HANDOFF_old.md')).toBe(null)
  expect(classifyPath('plans/HANDOFF_x.md')).toBe(null)
  expect(classifyPath('plans/handoffs/NOTES.md')).toBe(null)
  expect(classifyPath('plans/handoffs/HANDOFF_x.md.bak')).toBe(null)
})

test('reads the last READY or FAILED line', () => {
  const resume = 'report...\n\nCOMPACT-HANDOFF-READY: plans/handoffs/HANDOFF_a.md\n'
  expect(parseSentinel(resume)).toEqual({ ok: true, files: ['plans/handoffs/HANDOFF_a.md'] })
  const plan = '`COMPACT-HANDOFF-READY: plans/handoffs/HANDOFF_a.md | plans/handoffs/PLAN_a.md`'
  expect(parseSentinel(plan)).toEqual({ ok: true, files: ['plans/handoffs/HANDOFF_a.md', 'plans/handoffs/PLAN_a.md'] })
  expect(parseSentinel('COMPACT-HANDOFF-FAILED: disk full')).toEqual({ ok: false, reason: 'disk full' })
  expect(parseSentinel('COMPACT-HANDOFF-READY: a.md\nlater\nCOMPACT-HANDOFF-FAILED: x')).toEqual({ ok: false, reason: 'x' })
  expect(parseSentinel('no sentinel here')).toBe(null)
})

test("extracts the skill's paste prompt between the dashes", () => {
  const answer = [
    'Session is closed.',
    '-------------------------------------------------------',
    'PASTE THIS INTO YOUR NEXT SESSION:',
    '-------------------------------------------------------',
    'Read `plans/handoffs/HANDOFF_a.md` (seq 2, chain-x) and continue from "Where We\'re Going".',
    '',
    'Then wait for my go-ahead before executing.',
    '-------------------------------------------------------',
    'COMPACT-HANDOFF-READY: plans/handoffs/HANDOFF_a.md',
  ].join('\n')
  expect(extractPastePrompt(answer)).toBe(
    'Read `plans/handoffs/HANDOFF_a.md` (seq 2, chain-x) and continue from "Where We\'re Going".\n\nThen wait for my go-ahead before executing.',
  )
  const indented = '   PASTE THIS INTO YOUR NEXT SESSION:\n   ----------\n   Read `p.md`.\n   ----------'
  expect(extractPastePrompt(indented)).toBe('Read `p.md`.')
  expect(extractPastePrompt('PASTE THIS INTO YOUR NEXT SESSION:\n----------\nunterminated')).toBe(null)
  expect(extractPastePrompt('nothing')).toBe(null)
})

test('builds the marked instructions and the fallbacks', () => {
  const stub = stubText('plan', 'plans/handoffs/HANDOFF_a.md', 'plans/handoffs/PLAN_a.md')
  expect(stub).toContain('plan mode')
  expect(stub).toContain('PLAN_a.md')
  expect(buildInstructions(stub).split('\n')[0]).toBe(MARKER)
  expect(fallbackPrompt('plan', 'h.md', 'p.md')).toContain('Execute the plan starting at Phase 1')
  expect(fallbackPrompt('resume', 'h.md')).toContain('Where We\'re Going')
})

test('the fallback keeps the chain from the handoff header', () => {
  const head = '# T\n\n**Chain:** `PROJ-abc1` seq `1`\n**Parent:** none\n'
  expect(parseChain(head)).toBe('seq 1, PROJ-abc1')
  expect(parseChain('**Chain:** `x-1` seq 12')).toBe('seq 12, x-1')
  expect(parseChain('no chain here')).toBe(null)
  expect(fallbackPrompt('resume', 'h.md', undefined, 'seq 1, PROJ-abc1')).toContain('`h.md` (seq 1, PROJ-abc1)')
  expect(fallbackPrompt('plan', 'h.md', 'p.md', 'seq 2, t')).toContain('`h.md` (seq 2, t)')
  expect(fallbackPrompt('resume', 'h.md')).not.toContain('(seq')
})

test('resolves and compares paths across separators', () => {
  expect(resolvePath('C:\\repo', 'plans/handoffs/H.md')).toBe('C:\\repo\\plans/handoffs/H.md')
  expect(resolvePath('/repo/', './plans/H.md')).toBe('/repo/plans/H.md')
  expect(resolvePath('/repo', '/abs/H.md')).toBe('/abs/H.md')
  expect(resolvePath('C:\\repo', 'D:\\x\\H.md')).toBe('D:\\x\\H.md')
  expect(samePath('C:\\Repo\\plans\\handoffs\\H.md', 'plans/handoffs/h.md')).toBe(true)
  expect(samePath('plans/handoffs/A.md', 'plans/handoffs/B.md')).toBe(false)
})

// A slash command as the person types it.
const typed = (command: string, args = '') => ({
  command,
  args,
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: false, columns: 80 },
})

test('cancel clears a run and a second start is refused while one is running', async ($, on) => {
  mock.clock(on)
  const first = await $.command.run(typed('compact-handoff', 'note'))
  expect(first.text).toContain('compact mode')
  const second = await $.command.run(typed('compact-handoffplan'))
  expect(second.text).toContain('already in progress')
  const cancelled = await $.command.run(typed('compact-handoff', 'cancel'))
  expect(cancelled.text).toBe('cancelled.')
  const again = await $.command.run(typed('compact-handoffplan'))
  expect(again.text).toContain('/handoffplan')
})

test('the internal step is hidden from the menu and does nothing without a run', async ($, on) => {
  on('command.describe', ($, e) => ({ description: e.description, argumentHint: e.argumentHint, isHidden: e.isHidden }))
  const listed = await $.command.describe({
    command: 'compact-handoff-go',
    description: 'Internal step of /compact-handoff',
    isHidden: false,
    immediate: false,
    provider: { plugin: 'compact-handoff', tier: 'user' },
  } as never)
  expect(listed.isHidden).toBe(true)
  const shown = await $.command.describe({
    command: 'compact-handoff',
    description: 'Run /handoff',
    isHidden: false,
    immediate: false,
    provider: { plugin: 'compact-handoff', tier: 'user' },
  } as never)
  expect(shown.isHidden).toBe(false)
  const idle = await $.command.run(typed('compact-handoff-go'))
  expect(idle.text).toBe('nothing to compact.')
})
