# Handoff Output Template

Structure for the handoff file. Follow exactly — the next session relies on these section names.

```markdown
# {One-line summary of current work}

**Date:** {YYYY-MM-DD}
**Status:** {COMPLETED | IN PROGRESS | BLOCKED}
**Bead(s):** {active bead IDs, or "none"}
**Epic:** {parent epic/initiative name, if any}
**Chain:** `{chain_tag}` seq `{N}`
**Parent:** `{parent_filename}` or `none — first in chain`
**Prior chain:** `{file1}` > `{file2}` > ... > this  (or "none — first in chain")

{chain_tag examples:
  - Epic:    `authentication-overhaul`
  - Beads:   `myproject-xxxx`
  - Multi:   `myproject-xxxx, myproject-yyyy`
  - No bead: `standalone-a1b2c3d4`}

---

## Stale References

{INCLUDE ONLY if parent existed and some identifiers from parent aren't in current codebase.
Format:
- `old_identifier` — not found in codebase (was in parent seq N)
- `another_name` — not found in codebase

These may have been renamed/removed since parent. Don't guess; flag only. Next session resolves by reading code.
If all identifiers check out, OMIT entirely.}

## Related Handoffs

{INCLUDE ONLY if Step 1B found sibling handoffs on the same bead that AREN'T chain parents (different work streams).
Format:
- `HANDOFF_bead-xxx_other-topic_date.md` — {1-line topic}, separate work stream
Tells the next session these exist without treating them as continuation context.
OMIT if none.}

## Since Last Handoff

{INCLUDE ONLY if parent exists (seq > 1). Compare parent's plan vs reality:
- Parent's "Where We're Going" vs what actually happened
- Which open questions got answered
- Which risks materialized
- Trajectory: still on path, or priorities shifted?
3-8 bullets. Momentum, not snapshot.
If seq 1, OMIT entirely.}

## Reference Documents

{INCLUDE ONLY if project bibles/architecture docs exist:
- `plans/MY_PROJECT_BIBLE.md` — master reference for {domain}
- `CLAUDE.md` — project conventions
OMIT if none.}

## The Goal

{3-5 sentences. Overarching objective, why it matters, user's end state.
If a project bible exists, frame the goal in its context.}

## Where We Are

{15-25 bullets: every file/function changed, test counts, measurements with real numbers, what works/doesn't.
Under 10 = too aggressive.}

## What We Tried (Chronological)

{EVERY approach: hypothesis → changes → result (with numbers) → why it worked/didn't.
MOST EXPENSIVE to re-discover. 5-15 entries. Include prior session context.}

## Key Decisions

{Every non-obvious decision + WHY. Include rejected alternatives. 5-10 bullets.}

## Evidence & Data

{ALL raw data from the session:
- Comparison tables (approach A vs B vs C with metrics)
- Cost/budget tracking
- Iteration histories (v1→v2→v3, what changed, results)
- Status matrices (N/M complete)
- Commit logs (hash + summary table for 5+ commits)
- Benchmark numbers, accuracy %, error rates
- Data file paths for raw results

Never say "improved" — say "improved from X to Y". Use markdown tables.
Include small raw data blocks (<20 lines) that ARE primary evidence — ground truth annotations, reference configs, key YAML/JSON. Too expensive to re-derive.
8-20 items minimum. Chunked pass: expect 3+ tables. If fewer, mine deeper.}

## Code Analysis

{Function signatures, thresholds, constants, architecture, coupling.
Skip if no deep code reading. 5-10 bullets.}

## Files Changed

{Grouped by purpose:

### Source code
- path/to/file.py — what changed and why

### Tests
- path/to/test.py — what was tested

### Data & results
- path/to/results.json — what it contains

### Config
- path/to/config — what changed}

## User Feedback & Preferences (REQUIRED — never omit)

{EVERY piece of direction the user gave. Include:
- Direct corrections ("drops should only be 2-4 bars")
- Preferences ("cost doesn't matter", "I don't like post-processing")
- Frustrations ("the data is shit")
- Feature requests ("add editing tools to the dashboard")
- Process feedback ("stop asking, just do it", "launch parallel agents")
This is the user's VOICE. Calibrates next session's approach.
5-15 items for heavy sessions.}

## Where We're Going

{Ordered next steps with phase/step numbers. 3-7 bullets.}

## Risks & Blockers

{Upstream deps, flaky areas, env issues. 2-5 bullets. "None" if clear.}

## Open Questions

{Unknowns needing investigation. 1-5 bullets. "None" if answered.}

## Quick Start for Next Session

```bash
# Restore context
bd show {bead_id}

# Prior context (if OV available)
# /memory-recall {topic keywords}

# Reference docs
{paths to project bibles, if any}

# Key files to read first (not exhaustive — explore adjacent code too)
{3-5 most important files}

# Evidence / data files
{paths to test results, measurements}

# Verify current state
{test command or validation step}

# Next action
{THE single most important thing to do next}
```
```
