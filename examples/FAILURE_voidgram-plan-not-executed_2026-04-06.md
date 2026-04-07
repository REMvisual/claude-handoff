# Test Case: VoidGram Private API Safety — Plan Approved But Never Executed

**Date:** 2026-04-06
**Skill version:** v1.5.0 + first round of fixes (anti-close guards added)
**Project:** VoidGram
**Failure mode:** User said "yes" to execute plan → assistant closed session instead

---

## Context

Massive session: 100+ tool calls, 10+ hours, 8 research agents (security engineers, software 
architects, backend architects), FB cross-posting completion, cloud parity, Private API account 
lock investigation and relay architecture design.

## Handoff Output

- File: `HANDOFF_VoidGram-79t_fb-crosspost-private-api-safety_2026-04-06.md`
- Lines: 508 (above Tier 3 minimum of 500 — checkpoint worked)
- Chain: VoidGram-79t seq 5

## Plan Output

- File: `PLAN_VoidGram-79t_fb-crosspost-private-api-safety_2026-04-06.md`
- Lines: 195
- 6 phases: Zombie Processor Fix → Polling Relay → Session Safety → Fingerprint Hardening → Testing → Features/Polish

## What Improved (compared to CurveTool failure):

- Handoff hit 508 lines (checkpoint gate worked)
- Beads WERE created: 6 phase beads with dependency chains
- Plan mode entry/exit worked correctly
- Plan was presented verbatim and tasks created

## Critical Failure: Step 6 Transition (SAME AS BEFORE)

### User response to "Ready to start the plan?":
```
yes
```

### What should have happened:
1. Enter plan mode ✓
2. Read plan, present verbatim, create tasks ✓
3. User approves ✓
4. Exit plan mode
5. TaskUpdate Phase 1 to in_progress
6. Read source files from Quick Start
7. Start implementing: move initJobProcessor() after app.listen()

### What actually happened:
1-3 all correct ✓
4. **"Plan approved. Let me close this session with a commit and handoff prompt."**
5. Committed handoff + plan files
6. Wrote paste prompt for next session
7. Said "Session is closed"

### The anti-close instruction that was ignored:

The skill (after first round of fixes) contained:
```
**DO NOT close the session, commit-and-stop, write a paste prompt, or suggest starting 
a fresh session. The user said YES — that means execute. The `/handoff` skill's close 
protocol does not apply here. You already captured everything in the handoff file. 
There is nothing left to preserve. Build.**
```

This instruction existed in the skill but was not followed. The assistant went directly 
from "Plan approved" to "Let me close" without hesitation.

## Root Cause Analysis

1. The anti-close instruction was positioned BEFORE plan mode entry. By the time the 
   assistant exits plan mode (after presenting the plan, creating tasks, getting approval), 
   the instruction is no longer in active working memory.
2. The pre-EnterPlanMode message didn't include an execution commitment — it only primed 
   "read, present, create tasks" but not "then execute."
3. The post-approval step said "immediately begin executing Phase 1" but didn't prescribe 
   the literal first tool call. The assistant filled the gap with its own judgment: close.
4. Plan mode acts as a context boundary — instructions from before plan mode entry have 
   reduced influence after plan mode exit. The critical instruction needs to survive this 
   boundary.

## Fixes Applied (second round):

1. Pre-plan-mode message now includes: "After you approve: I will EXIT plan mode and 
   IMMEDIATELY start coding Phase 1. No close, no paste prompt — I build."
2. Added user escape valve: "If you see me trying to close, tell me: Execute the plan."
3. Post-approval is now three PRESCRIBED tool calls: (1) TaskUpdate Phase 1 to in_progress, 
   (2) Read source files, (3) Write code. Not "begin executing" — literal tool call sequence.
4. "There is no action between plan approval and these three steps."
