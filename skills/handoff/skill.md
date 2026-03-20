---
name: handoff
description: Create a structured session handoff when context is running low or work is pausing. Deep context mining, self-validation, multi-file splitting. Captures everything the next session needs.
user_invocable: true
triggers:
  - handoff
  - save context
  - context running low
  - wrap up session
  - session handoff
  - save progress
  - running out of context
argument-hint: [optional reason, e.g. "context low", "end of day"]
---

# Session Handoff

**IMPORTANT: This skill writes files. You MUST NOT be in Claude Code's built-in plan mode.**
If you are currently in plan mode, **exit plan mode first** (use ExitPlanMode) before proceeding.

You are creating a structured handoff document that preserves session context for the next session with **minimal context cost on reload**.

**This skill typically runs at ~75% context usage** — you have a LOT of conversation history to mine. Use it. The whole point is to extract maximum value from the session before closing.

The user should NOT need to write anything or provide any context — you gather everything automatically. Just `/handoff` is sufficient.

**Arguments:** $ARGUMENTS

---

## Step 1: Deep Context Gathering

This is the most important step. You are mining the ENTIRE conversation for data. Do not rush this.

### 1A: External State

Run these in parallel. Silently skip any that aren't available:

```bash
# Git state
git log --oneline -20
git diff --stat
git status -s | head -30

# Task tracker integration (optional — works with beads, or adapt to your tracker)
bd list --status=in_progress 2>/dev/null
bd list --status=open --priority=0,1 2>/dev/null

# Existing handoffs (check for prior work on this topic)
ls -la plans/handoffs/ 2>/dev/null || ls -la .claude/handoffs/ 2>/dev/null

# Active plan files
ls plans/*.md 2>/dev/null | head -10
```

### 1B: Chain Detection & Prior Session Context

**This step determines whether you are continuing an existing chain or starting a new one.**

#### Step 1B-1: Resolve the Chain Tag

The chain tag identifies which work stream this handoff belongs to. It uses **existing bead/epic identifiers** — no separate chain IDs.

**Resolution order** (use the first that applies):

1. **Epic exists** → use the epic name/ID as the chain tag. Epics are the most stable identifier — they outlive individual beads and naturally span many handoffs.

2. **No epic, 1-4 beads** → use all bead IDs as the chain tag (e.g., `myproject-1abc, myproject-3def`). This is the common case for focused work.

3. **No epic, 5+ beads** → pick the 2-3 beads most relevant to the primary work stream. Use your judgment based on what the session actually focused on.

4. **No beads, no epic** → generate a standalone 8-char hex ID as fallback:
   ```bash
   python3 -c "import secrets; print(secrets.token_hex(4))" 2>/dev/null || openssl rand -hex 4 2>/dev/null || printf '%08x' $RANDOM$RANDOM
   ```

#### Step 1B-2: Find Prior Handoffs in This Chain

Use the **two-tier detection** to find the parent handoff. Stop at the first tier that matches:

**Tier 1: Paste Prompt (deterministic)**

Check how this session was started. If the user pasted a prompt like:
```
Read `HANDOFF_foo_2026-03-19.md` (seq 2, myproject-1abc) and continue...
```
Then you have the parent file directly. **Read that parent file's header** to get the chain tag and seq number. This is a **continuation** — inherit the chain tag, set seq = parent's seq + 1, set parent = that file.

**Tier 2: Bead/Epic Scan (structured)**

If no paste prompt references a handoff, scan the handoff directory for files with the same chain tag (bead IDs or epic):
```bash
# Search by bead ID
grep -l "Chain:.*{bead_id}" plans/handoffs/HANDOFF_*.md 2>/dev/null
# Or search by epic
grep -l "Chain:.*{epic_name}" plans/handoffs/HANDOFF_*.md 2>/dev/null
```
If found, read the **latest** matching file (highest seq number). This is a **continuation** — inherit chain tag, increment seq, set parent.

**If neither tier matches:** This is the **first handoff in a new chain**. Set `seq: 1`, `parent: none`.

#### Step 1B-3: Load Prior Context

**Check persistent memory** (if a memory/recall tool is available):
- Run your memory tool with 2-3 different keyword searches related to the current work (e.g., feature name, bug area, epic name, key function names)
- Look for: prior handoffs/plans on the same topic, past decisions, previous failed approaches, context from earlier sessions
- If your memory tool returns relevant prior context, it MUST be incorporated — especially into "What We Tried" and "Key Decisions"

**If this is a continuation:**
- Read the parent handoff file for context (but DON'T load its full content into the new handoff — soft reference only)
- Note what changed since the parent handoff

**If this is a new chain:**
- Scan for any handoff files with related slugs as a courtesy check — if you find related prior work, mention it in the header but don't inherit its chain tag

#### Step 1B-4: Stale Reference Check

**If a parent handoff was found**, scan it for code identifiers (function names, class names, parameter names, variable names, file paths) and spot-check whether they still exist in the codebase:

```bash
# Extract key identifiers from the parent handoff's code blocks and backtick-quoted names,
# then grep each against the project source. Flag any that return zero matches.
```

- Only check identifiers that look like code (backtick-quoted, in code blocks, or clearly a function/class/param name) — skip prose
- If any identifiers are missing from the codebase, add a `## Stale References` section early in the new handoff listing what was renamed/removed since the parent, so the next session doesn't trust outdated names
- Don't try to guess what they were renamed to — just flag them. The next session will resolve it by reading actual code
- If ALL identifiers check out, skip the section entirely — no noise

### 1C: Conversation Mining Checklist

**If arguments were provided** (check `$ARGUMENTS` above): use them as a soft hint for framing — they may suggest the epic name, the goal, or what the user considers most important. Let them guide your emphasis in "The Goal" and "Where We're Going" sections, but don't let them override what actually happened in the conversation. The conversation is ground truth; arguments are a lens, not a filter.

Go through the ENTIRE conversation systematically. For each category, extract ALL relevant data:

- [ ] **Goals & objectives** — What was the user trying to achieve? What's the overarching epic?
- [ ] **Work completed** — Every file modified, function changed, feature added, bug fixed. With specifics.
- [ ] **Approaches tried** — Every approach attempted, whether successful or not. Chronological order.
- [ ] **Failed approaches** — Why each failed. What the error was. What the data showed. MOST EXPENSIVE to re-discover.
- [ ] **Test results & measurements** — Every number, benchmark, comparison, pass/fail count. Raw data.
- [ ] **Data files created** — Paths to any JSON, CSV, log files with test results or measurements.
- [ ] **Decisions made** — Every decision and its rationale. Include what was REJECTED and why.
- [ ] **Discoveries & gotchas** — Non-obvious things learned. Upstream issues found. Architectural insights.
- [ ] **Code analysis** — Key findings from reading source code. Function signatures, parameter values, thresholds.
- [ ] **User preferences expressed** — Any direction the user gave about approach, priorities, or constraints.
- [ ] **Remaining questions** — Unknowns that still need investigation.
- [ ] **Dependencies on other work** — Other beads, PRs, or systems that affect this work.

**If you find yourself skimming or summarizing, STOP.** Re-read the conversation. The value of this skill is in the details.

---

## Step 2: Choose Output Location

Use the first available directory:
1. `plans/handoffs/` — if `plans/` directory exists
2. `.claude/handoffs/` — fallback
3. Create `plans/handoffs/` if neither exists

## Step 3: Generate File Name

File names must be **descriptive** — someone scanning the directory should immediately know what chain a file belongs to and what it's about.

**If a task tracker is available** (chain tag resolved in Step 1B-1):

Format: `HANDOFF_{chain_tag}_{slug}_{YYYY-MM-DD}.md`

- **chain_tag:** The task/epic ID from Step 1B-1 (e.g., `PROJ-n6ji`). For multi-task chains, use the primary task only (the one most central to the work).
- **slug:** 2-4 word kebab-case summary of the topic
- **Date:** `YYYY-MM-DD`
- Example: `HANDOFF_PROJ-n6ji_dsp-phase0-baseline-reset_2026-03-19.md`

**If no task tracker is available** (standalone hex fallback):

Format: `HANDOFF_{slug}_{YYYY-MM-DD}.md`

- **slug:** 2-4 word kebab-case summary of the topic
- **Date:** `YYYY-MM-DD`
- Example: `HANDOFF_auth-middleware-rewrite_2026-03-19.md`

If a file with the same name already exists, append a counter: `_2`, `_3`, etc.

## Step 4: Write the Handoff File

Write to `{handoff_dir}/{filename}` using this structure.

### Line Budget & Splitting

- **Target: 180-300 lines per file.**
- **Hard minimum: 150 lines.** If your draft is under 150 lines, you haven't captured enough. Go back to Step 1C and re-mine the conversation.
- **Light sessions** (quick fix, single feature) may go as low as **80 lines** — but only if the session was genuinely short.
- **If data exceeds 300 lines:** Split into multiple files (use the same prefix from Step 3):
  - `{filename_without_ext}_part1.md` — Session state, goals, where we are, what we tried
  - `{filename_without_ext}_part2.md` — Evidence & data, test results, comparison tables, code analysis
  - Link them: Part 1 header says `**See also:** part2 for evidence & data tables`

**When in doubt, go longer.** It's cheaper to skip a section on reload than to re-discover lost context.

### Handoff Structure

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
  - Epic:    `BPM engine unification`
  - Beads:   `myproject-1abc`
  - Multi:   `myproject-1abc, myproject-3def`
  - No bead: `standalone-a1b2c3d4`}

---

## Stale References

{ONLY include this section if Step 1B-4 found identifiers from the parent handoff that no longer exist in the codebase. Otherwise OMIT entirely.

Format:
- `old_identifier` — not found in codebase (was in parent handoff seq N)
- `another_name` — not found in codebase

These names may have been renamed or removed since the parent handoff. Check the actual code for current names.}

## The Goal

{3-5 sentences. What is the overarching objective? Why does it matter? What's the user's end state?}

## Where We Are

{Comprehensive bullet list of what was accomplished AND what the data shows. Be exhaustive:
- Every file modified with what changed and why
- Every function/method added or changed with its signature
- Test counts (X pass, Y fail, Z skip)
- Measurements with actual numbers (BPM values, error rates, latencies, accuracy %)
- A/B comparisons between approaches (before vs after)
- Current state of the system — what works, what doesn't
15-25 bullets for heavy sessions. If you have fewer than 10, you're summarizing too aggressively.}

## What We Tried (Chronological)

{EVERY approach attempted this session, in order. For each:
1. What was the hypothesis/approach
2. What was done (specific changes)
3. What the result was (with numbers if available)
4. Why it worked / didn't work / was abandoned
5. What we learned from it

This is the SINGLE MOST EXPENSIVE section to re-discover. Be thorough.
Include approaches from prior sessions too (from memory/prior handoffs).
5-15 entries depending on session complexity.
Skip this section ONLY if the session was genuinely straightforward with no pivots.}

## Key Decisions

{Every non-obvious decision and WHY. Include:
- What was decided
- What alternatives were considered
- Why this option was chosen (constraints, data, user preference)
- What was explicitly REJECTED and why — so the next session doesn't re-try it
5-10 bullets.}

## Evidence & Data

{ALL test results, measurements, baselines, comparison tables. Include:
- Actual numbers — never say "improved" without saying by how much
- Reference data files by full path
- Comparison tables where relevant (markdown tables work well)
- Error analysis — what the numbers mean, not just what they are
- Baseline numbers that success criteria should reference
8-20 bullets or a combination of bullets and tables.
Skip this section ONLY if the session produced zero measurements.}

## Code Analysis

{Key findings from reading source code that the next session needs:
- Function signatures and parameter values that matter
- Thresholds, constants, magic numbers with their current values
- Architecture/data flow relevant to the work
- Coupling points, upstream dependencies
Skip if the session didn't involve deep code reading.
5-10 bullets when applicable.}

## Files Changed

{Every file modified/created, grouped by purpose:
### Source code
- path/to/file.py — what changed and why

### Tests
- path/to/test.py — what was tested

### Data & results
- path/to/results.json — what it contains

### Config
- path/to/config — what changed}

## Where We're Going

{Ordered bullet list of what comes next. Include phase/step numbers if part of a larger plan. 3-7 bullets.}

## Risks & Blockers

{Anything that could derail the next session. Include upstream dependencies, known flaky areas, environment issues.
2-5 bullets. "None" if clear.}

## Open Questions

{Things we still don't know. Unknowns that need investigation. Hypotheses that haven't been tested.
1-5 bullets. "None" if all questions are answered.}

## Quick Start for Next Session

```bash
# Task context (if tracker available)
# bd show {task_id}  # beads example

# Prior context (if memory system available)

# Key files to read first
{3-5 most important files for understanding current state}

# Evidence / data files
{paths to test results, measurements, comparison data}

# Verify current state
{test command or validation step}

# Next action
{THE single most important thing to do next}
```
```

---

## Step 4-CHECK: Self-Validation

**This step is mandatory. Do not skip it.**

After writing the handoff, count its lines and validate:

### 1. Line Count Check

| Session type | Under this = FAIL | Target range |
|---|---|---|
| Light (quick fix) | Under 80 | 80-120 |
| Medium (multi-step) | Under 120 | 120-180 |
| Heavy (testing, data, multiple approaches) | Under 150 | 180-300 |

If **FAIL**: Go back to Step 1C, re-mine the conversation, and expand thin sections. Common culprits:
- "Where We Are" has fewer than 10 bullets
- "What We Tried" is missing or has only 1-2 entries
- "Evidence & Data" summarizes instead of giving actual numbers
- "Key Decisions" has only 1 entry
- "Code Analysis" is missing when you read source code during the session

### 2. Data Completeness Check

- [ ] Does "Where We Are" include specific file names AND function names?
- [ ] Does "What We Tried" include at least one entry for every distinct approach discussed?
- [ ] Does "Evidence & Data" include actual numbers, not summaries? ("error rate: 28.6%" not "high error")
- [ ] Does "Key Decisions" include at least one rejected alternative?
- [ ] If prior handoffs exist on this topic, is there a clear "what changed since last time"?
- [ ] Does "Quick Start" have a concrete first action, not just "continue working"?
- [ ] Are data file paths included so the next session can reference raw results?

### 3. Chain Check

- [ ] Does the **Chain** line have a valid chain tag (epic name, bead ID(s), or standalone hex)?
- [ ] If this is a continuation, does the **Parent** file actually exist?
- [ ] Is the **Prior chain** breadcrumb accurate (lists all ancestors in order)?
- [ ] If this is seq 1, is Parent set to `none — first in chain`?

### 4. Split Check

- Over 300 lines? **SPLIT** into part1 + part2 with cross-references (see splitting rules in Step 4).

### 5. If any check fails

Fix the handoff before proceeding. Rewrite the thin sections. You have ~25% context remaining — use it.

---

## Step 5: Update Beads (if available)

# Task tracker integration (optional — works with beads, or adapt to your tracker)
If beads are available and tasks are in_progress, update their notes:

```bash
bd update {id} --notes "Handoff written. See {file_path}"
```

## Step 6: Persist to Memory (if available)

# Task tracker integration (optional — works with beads, or adapt to your tracker)
If `bd remember` is available:
```bash
bd remember "Handoff written to {path}. Chain: {chain_tag} seq {N}. Status: {status}. Next: {next action}"
```

## Step 7: Report

Tell the user concisely:
- File(s) written and path(s)
- Line count(s)
- Chain info (chain ID, seq number, whether new or continuation)
- Whether self-check passed (and what was expanded if it didn't on first pass)
- The "Next Action"

## Step 8: Ask to Close Session

After the file is written and confirmed, ask the user:

> **Handoff complete.** Ready to close this session?
>
> - **Yes** — I'll commit all changes, mark "session closed," and give you a ready-to-paste prompt for the next session
> - **No** — We'll continue working. I'll remind you to close when you're done.
>
> *(Closing commits all uncommitted work by default — say "close without commit" to skip.)*

**If the user says YES (or just "yes"):**

1. **Commit all session work.** This is the default — don't ask again, just do it:
   ```bash
   git status -s
   git diff --stat
   ```
   - If there are uncommitted changes: stage all changed/new files relevant to this session's work, then commit with:
     ```
     session: {slug} [{chain_tag}]

     {One-line summary of what this session accomplished}

     Handoff: {handoff_filename}
     Task(s): {task_ids or "none"}
     ```
   - Show the user what was committed (file list + commit hash)
   - If working tree is already clean, say "Working tree clean — nothing to commit"
   - **Be surgical:** only commit files related to this session's work. If `git status` shows unrelated changes from other sessions, mention them but don't commit them. When in doubt, list the files and ask.

2. Append to the handoff file:
   ```
   ## Session Closed
   **Closed at:** {timestamp}
   **Commit:** {short hash}
   **Session status:** Handed off to next session
   ```

3. Output the **ready-to-paste prompt** for the next session:
   ```
   -------------------------------------------------------
   PASTE THIS INTO YOUR NEXT SESSION:
   -------------------------------------------------------
   Read `{path to file}` (seq {N}, {chain_tag}) and continue from "Where We're Going". Check your task tracker for active work.

   Before starting work, narrate your onboarding:
   1. Read the handoff file and summarize what you understand (goal, current state, what was tried)
   2. Show which task(s) you're claiming and what phase/step you're starting
   3. State what you'll verify first (run tests, check baselines, read key files)
   4. Explain your planned first action and why
   Then wait for my go-ahead before executing.
   -------------------------------------------------------
   ```

4. Tell the user: "Session is closed. Paste the prompt above into a fresh session to continue."

**If the user says "close without commit":**

Follow steps 2-4 above but skip the commit. Warn: "Changes are uncommitted — next session or other sessions may see dirty state."

**If the user says NO:**

1. Tell the user: "Handoff saved. When you're ready to close, just say 'close session' or run `/handoff` again."
2. Continue the conversation normally.
3. On any subsequent `/handoff` or "close session" or "done" or "wrap up", repeat this close flow.

---

## Cleanup: Archiving Completed Chains

When a bead or epic is closed and all work is done, archive the handoff chain:

```bash
# Find all handoffs for a bead
grep -l 'Chain:.*{bead_id}' plans/handoffs/HANDOFF_*.md plans/handoffs/PLAN_*.md 2>/dev/null

# Or for an epic
grep -l 'Chain:.*{epic_name}' plans/handoffs/HANDOFF_*.md plans/handoffs/PLAN_*.md 2>/dev/null

# Move to archive
mkdir -p plans/handoffs/archive/
mv {matching files} plans/handoffs/archive/
```

**Archive, don't delete.** Old handoffs sometimes contain useful decisions/context. The `archive/` subdirectory keeps the active directory clean.

---

## Rules

1. **You run at ~75% context.** You have massive conversation history available. MINE IT. Every measurement, every failed approach, every decision, every code insight.
2. **Hard minimum: 150 lines** for medium/heavy sessions. If under 150, you haven't mined deeply enough.
3. **Split over 300 lines.** Don't cram — split into parts and cross-reference.
4. **Self-check is mandatory.** Step 4-CHECK must pass before proceeding. If it fails, fix the handoff.
5. **WHY over WHAT.** Code is in git. Decisions, failed approaches, data, and reasoning are what get lost.
6. **"What We Tried" is chronological and exhaustive.** Include EVERY approach, not just the final one.
7. **"Evidence & Data" must have real numbers.** Never say "improved" — say "improved from 156.6 to 131.2 (error: 28.6 → 3.2)".
8. **Prior session context flows in.** Check persistent memory and existing handoff files. Note what changed since last handoff.
9. **"If you find yourself skimming, STOP."** Re-read the conversation. The value is in the details.
10. **Quick Start is king.** First commands should restore full context (handoff + memory + key files).
11. **Zero input required.** `/handoff` with no arguments must work perfectly.
12. **Always ask to close.** Every handoff ends with the close session prompt.
13. **Descriptive file names.** Names describe content, not increment counters.
14. **No LATEST.md.** The paste prompt is the only resume mechanism.
15. **Auto-handoffs are thinner.** If triggered by PreCompact, the file should be under 50 lines (emergency capture, not full mining).
16. **Reference, don't inline.** Point to files and beads instead of copying their content.
17. **No code snippets.** No API tables. No architecture diagrams. Those live in CLAUDE.md.
18. **Chain continuity.** Every handoff must have valid Chain/Parent/Prior chain fields. Use bead/epic IDs as chain tags — no separate chain IDs needed. Resolution order: epic > beads (1-4) > most relevant beads (5+) > standalone hex fallback.
19. **Paste prompt carries chain tag.** The ready-to-paste prompt must include `seq {N}, {chain_tag}` so the next session can detect the chain deterministically (Tier 1).
