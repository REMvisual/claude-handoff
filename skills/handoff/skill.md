---
name: handoff
description: Create a structured session handoff when context is running low or work is pausing. Deep context mining, self-validation, multi-file splitting. Captures everything the next session needs.
user_invocable: true
triggers:
  - do a handoff
  - create a handoff
  - run handoff
  - save session context
  - session handoff
  - save session progress
  - running out of context
argument-hint: [optional reason, e.g. "context low", "end of day"]
---

# Session Handoff

**IMPORTANT: This skill writes files. You MUST NOT be in Claude Code's built-in plan mode.**
If you are currently in plan mode, **exit plan mode first** (use ExitPlanMode) before proceeding.

**TRIGGER GUARD: Do NOT execute this skill if the user is merely _discussing_ handoffs, editing handoff files, or referencing the handoff skill in conversation.** This skill should ONLY run when the user explicitly wants to CREATE a handoff right now — i.e., they are requesting to save session state and potentially close. If the context is ambiguous (e.g., "let's talk about the handoff skill", "update the handoff format", "what does the handoff do"), do NOT run the skill — just respond normally. When in doubt, ask: "Did you want me to create a handoff now, or are we just discussing it?"

You are creating a structured handoff document that preserves session context for the next session with **minimal context cost on reload**.

**This skill typically runs at ~75% context usage** — you have a LOT of conversation history to mine. Use it. The whole point is to extract maximum value from the session before closing. On a 1M context model, 75% means ~750K tokens of history — significantly more to mine and significantly more room in the handoff file.

The user should NOT need to write anything or provide any context — you gather everything automatically. Just `/handoff` is sufficient.

**Arguments:** $ARGUMENTS

---

## Agent Strategy

**Parallelize independent research.** Launch agent teams in a single message — do NOT run independent tasks sequentially.

| What | Parallel? | Why |
|---|---|---|
| Step 1A: External state (git, beads, plans) | Yes — 3 agents or Bash calls | Independent queries |
| Step 1B-3/4: OV recall + stale refs | Yes — 2-3 agents | Independent research |
| Step 1C: Conversation mining | No — main agent only | Only you have the history |
| Steps 5+6: Beads + memory persist | Yes — parallel Bash calls | Independent writes |

---

## Step 1: Deep Context Gathering

This is the most important step. You are mining the ENTIRE conversation for data. Do not rush this.

### 1A: External State

**Launch in parallel** (as agents or parallel Bash calls — judgment based on complexity):

| Agent | Commands | Returns |
|---|---|---|
| Git State | `git log --oneline -20`, `git diff --stat`, `git status -s \| head -30`, `git branch --show-current` | Branch, recent commits, uncommitted changes |
| Task State | `bd list --status=in_progress`, `bd list --status=open --priority=0,1`, `bd stats` | Active/open beads (skip if bd unavailable) |
| Prior Handoffs | `ls plans/handoffs/`, `ls .claude/handoffs/`, `ls plans/*.md` | Existing handoff files, dates, chain tags |

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
Read `HANDOFF_myproject-1abc_foo_2026-03-19.md` (seq 2, myproject-1abc) and continue...
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

#### Step 1B-3 + 1B-4: Prior Context, Reference Docs & Stale Check (PARALLEL AGENTS)

**Once chain tag is resolved from 1B-1/1B-2, launch in parallel:**

| Agent | Task | Returns |
|---|---|---|
| OV Recall | `/memory-recall` with 2-3 keyword searches (feature name, bug area, key functions) | Prior decisions, failed approaches, earlier session context |
| Parent Context (MUST READ FULL CONTENT) | Read the ENTIRE parent handoff file — not just the header. Extract: (1) The Goal, (2) Where We Are summary, (3) Key Decisions, (4) What We Tried entries, (5) Where We're Going (what was planned next), (6) Open Questions, (7) code identifiers for stale check | Full parent summary for "Since Last Handoff" section + identifier list |
| Reference Docs | Scan for project bible/reference docs: `ls plans/*BIBLE* plans/*bible* *BIBLE* CLAUDE.md .claude/CLAUDE.md 2>/dev/null`. If found, read the doc and extract: project goals, architecture decisions, key constraints, vocabulary/terminology | Project context that grounds the handoff |
| Stale Refs | Grep each identifier from parent against codebase | List of identifiers NOT found (stale) |

Skip agents that don't apply (no OV → skip recall; no parent → skip Parent+Stale; no bible → skip Reference Docs).

**Parent cross-referencing is MANDATORY when a parent exists.** The agent MUST read the parent file's full content and produce a "Since Last Handoff" comparison showing: what was planned (parent's "Where We're Going") vs what actually happened, which open questions got answered, which risks materialized. This gives the next session a sense of trajectory, not just a snapshot.

Merge results: parent context → "Since Last Handoff" section + "What We Tried" (include prior approaches). OV context → "Key Decisions". Reference doc context → "The Goal" framing. Stale refs → "Stale References" section.

**Rules for stale references:**
- Only check identifiers that look like code (backtick-quoted, in code blocks, or clearly a function/class/param name) — skip prose
- If any identifiers are missing from the codebase, add a `## Stale References` section early in the new handoff listing what was renamed/removed since the parent, so the next session doesn't trust outdated names
- Don't try to guess what they were renamed to — just flag them. The next session will resolve it by reading actual code
- If ALL identifiers check out, skip the section entirely — no noise

### 1C: Conversation Mining

**If arguments were provided** (check `$ARGUMENTS` above): use them as a soft hint for framing — they may suggest the epic name, the goal, or what the user considers most important. The conversation is ground truth; arguments are a lens, not a filter.

#### Context-Size Strategy (MANDATORY — announce your tier before mining)

**You MUST announce which tier you are using before starting extraction.** Write: "Mining at Tier N (reason)." This is not optional.

Research shows LLMs exhibit a "lost in the middle" problem — 30%+ accuracy drop for information in the middle of long contexts. A single extraction pass at 500K+ tokens demonstrably misses decisions, measurements, and failed approaches from the middle ~50% of conversation.

**Tier detection (use the first that matches):**
- System prompt says "1M context" AND you've had 50+ tool calls or worked over an hour → **Tier 3**
- System prompt says "1M context" OR conversation has been substantial (20+ tool calls) → **Tier 2**
- Otherwise → **Tier 1**

**Tier 1 — Standard (under ~100K tokens):**
Single pass with the extraction checklist below.

**Tier 2 — Large (~100K-500K tokens):**
Two passes:
1. **Structured extraction** — Full checklist pass. Force yourself: "Scan the MIDDLE third of this conversation for decisions and measurements I might skip."
2. **Gap-filling sweep** — Review your extraction. Ask: "What from the FIRST HALF is missing? What user feedback from MID-SESSION did I skip?"

**Tier 3 — Massive (~500K+ tokens):**
Map-reduce — single pass WILL miss information at this scale.
1. **Segment** the conversation into 3-4 chronological chunks. Use natural breakpoints.
2. **Per-chunk extraction** — Run the FULL checklist against EACH chunk independently. Tag findings: (early/mid/late).
3. **Merge + deduplicate** — Later decisions override earlier. Build chronological timeline.
4. **Validation pass** — "What is missing for a new agent to continue? What comparison tables, cost data, or iteration histories did I skip?"

**Tier 3 specifically requires richer Evidence & Data.** Heavy sessions produce commit logs, cost tables, approach comparisons, iteration histories, status matrices, and raw data. ALL of these must be captured — they are the most expensive to re-derive. If your Evidence section has fewer than 3 tables or comparison data sets, you haven't mined deep enough.

**Tier 3 target: 800 lines. Minimum: 500.** A 10+ hour session with 100+ tool calls cannot be captured in 400 lines. Phase 1 (initial Write) will typically produce 350-450 lines. Phase 2 (gap research + Edit) should push it to 500-800. The ceiling exists — USE IT.

#### Extraction Checklist

For each category, extract ALL relevant data (applied per-chunk in Tier 3, or full-pass in Tier 1-2):

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

**If beads are available** (chain tag resolved in Step 1B-1):

Format: `HANDOFF_{chain_tag}_{slug}_{YYYY-MM-DD}.md`

- **chain_tag:** The bead/epic ID from Step 1B-1 (e.g., `Audiophile-n6ji`). For multi-bead chains, use the primary bead only (the one most central to the work).
- **slug:** 2-4 word kebab-case summary of the topic
- **Date:** `YYYY-MM-DD`
- Example: `HANDOFF_Audiophile-n6ji_dsp-phase0-baseline-reset_2026-03-19.md`

**If beads are NOT available** (no beads installed, standalone hex fallback):

Format: `HANDOFF_{slug}_{YYYY-MM-DD}.md`

- **slug:** 2-4 word kebab-case summary of the topic
- **Date:** `YYYY-MM-DD`
- Example: `HANDOFF_auth-middleware-rewrite_2026-03-19.md`

If a file with the same name already exists, append a counter: `_2`, `_3`, etc.

## Step 4: Write the Handoff File

Write to `{handoff_dir}/{filename}` using this structure.

### Line Budget & Splitting

**Model-aware limits:** Check your system prompt for context window size. If it says "1M context" or "1m", use the **Extended** column. Otherwise use **Standard**.

| | Standard (200K) | Extended (1M) |
|---|---|---|
| **Target (aim for ceiling)** | 300-400 lines | 500-800 lines |
| **Hard minimum** | 150 lines | 250 lines |
| **Light session min** | 80 lines | 120 lines |
| **Split threshold** | 400 lines | 800 lines |
| **Auto-handoff (PreCompact)** | 50 lines | 80 lines |

**Target the CEILING, not the floor.** An 800-line handoff on 1M context is ~0.7% of the window — negligible. More detail = less re-discovery. The cost of a handoff that's "too long" is near zero; the cost of one that's too short is hours of re-investigation.

- If your draft is under the hard minimum, you haven't captured enough.
- **Light sessions** (quick fix) may go as low as the light session min.

### Two-Phase Write Process

**Phase 1: Initial Write** — Compose and write the handoff as ONE file in ONE Write call. Include all sections — narrative, evidence, code analysis, everything. Do NOT pre-split into multiple files.

**Phase 2: Gap Research & Expansion** — After writing, count the lines. Then do a GAP RESEARCH pass:
1. Read back what you just wrote
2. Scan the conversation for data you DIDN'T capture: tables you skipped, user feedback you missed, measurements without numbers, approaches mentioned but not detailed, raw data blocks not inlined
3. Use the Edit tool to append missing content — additional evidence tables, expanded entries, inline data blocks, sections you compressed too aggressively
4. Keep expanding until you approach the ceiling (400 standard / 800 extended)

**The gap research pass is MANDATORY for Tier 2 and Tier 3.** At Tier 1, it's optional. The whole point is that your first write will miss things (especially from mid-conversation) — the second pass catches them.

**Splitting:** ONLY split if the final file (after Phase 2 expansion) exceeds the split threshold. Under threshold = one file, period.

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

## Since Last Handoff

{ONLY include if a parent handoff exists (seq > 1). Compare parent's plan vs reality:
- What the parent's "Where We're Going" said to do next vs what actually happened
- Which of the parent's "Open Questions" got answered (and how)
- Which "Risks & Blockers" materialized or were resolved
- Key trajectory shift: are we still on the same path or did priorities change?
This gives the next session a sense of MOMENTUM, not just a snapshot. 3-8 bullets.
If this is seq 1 (first in chain), OMIT this section entirely.}

## Reference Documents

{List any project bibles, architecture docs, or reference files that ground this work. Include path and a 1-line description of what it contains:
- `plans/MAESTRO_ML_BIBLE.md` — Master reference for ML pipeline architecture and training strategy
- `CLAUDE.md` — Project-specific instructions and conventions
OMIT if no reference docs exist in the project.}

## The Goal

{3-5 sentences. Overarching objective, why it matters, user's end state. If a project bible exists, frame the goal in its context.}

## Where We Are

{15-25 bullets: every file/function changed, test counts, measurements with real numbers, what works/doesn't. Under 10 = too aggressive.}

## What We Tried (Chronological)

{EVERY approach chronologically: hypothesis, changes, result (with numbers), why it worked/didn't. MOST EXPENSIVE to re-discover. 5-15 entries. Include prior sessions.}

## Key Decisions

{Every non-obvious decision + WHY. Include rejected alternatives. 5-10 bullets.}

## Evidence & Data

{This section must contain ALL raw data from the session. Include:
- Comparison tables (approach A vs B vs C with metrics)
- Cost/budget tracking (what was spent, what remains)
- Iteration histories (v1→v2→v3 with what changed and results)
- Status matrices (N/M complete, per-item status)
- Commit logs (hash + summary table for sessions with 5+ commits)
- Benchmark numbers, accuracy percentages, error rates
- Data file paths so next session can reference raw results
Never say "improved" — say "improved from X to Y". Use markdown tables.
Include small raw data blocks (under 20 lines) that ARE primary evidence — ground truth annotations, reference configs, key YAML/JSON snippets. These are too expensive to re-derive and too important to just reference by path.
8-20 items minimum. At Tier 3, expect 3+ tables. If you have fewer, go back and mine.}

## Code Analysis

{Function signatures, thresholds, constants, architecture, coupling points. Skip if no deep code reading. 5-10 bullets.}

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

## User Feedback & Preferences (REQUIRED — never omit)

{EVERY piece of direction the user gave this session. This section calibrates the next session's priorities and approach. Include:
- Direct corrections ("drops should only be 2-4 bars")
- Preferences expressed ("I don't like post-processing", "cost doesn't matter")
- Frustrations ("the data is shit", "why is it splitting files")
- Feature requests ("add editing tools to the dashboard")
- Process feedback ("stop asking, just do it", "launch parallel agents")
This is the user's VOICE. A new agent reading this knows what the user cares about, what annoys them, and how to calibrate their approach. 5-15 items minimum for heavy sessions.}

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

# Reference docs (bibles, architecture docs)
{paths to project bibles or reference docs, if any}

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

Use the **model-aware limits** from Step 4's Line Budget table. **Target the ceiling, not the floor.**

| Tier | Minimum | Target ceiling | You MUST expand if under |
|---|---|---|---|
| Tier 1 (Standard) | 150 | 400 | 150 |
| Tier 1 (Extended/1M) | 250 | 800 | 250 |
| Tier 2 | 300 | 600 | 300 |
| Tier 3 | 500 | 800 | 500 |

**If under the "MUST expand" threshold:** Run Phase 2 (gap research). Read back your file, scan the conversation for uncaptured data, and use Edit to append. Do NOT proceed to Steps 5+6 until you're above the threshold.

**If between threshold and ceiling:** Phase 2 is still recommended. There's almost certainly data you missed.

If **FAIL**: Go back and expand thin sections. Common culprits:
- "Where We Are" has fewer than 10 bullets
- "What We Tried" is missing or has only 1-2 entries
- "Evidence & Data" summarizes instead of giving actual numbers
- "Key Decisions" has only 1 entry
- "Code Analysis" is missing when you read source code during the session

### 2. Data Completeness Check

- [ ] Does "Where We Are" include specific file names AND function names?
- [ ] Does "What We Tried" include at least one entry for every distinct approach discussed?
- [ ] Does "Evidence & Data" include actual numbers, not summaries? ("error rate: 28.6" not "high error")
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

- Over the split threshold (300 standard / 600 extended)? **SPLIT** into part1 + part2 with cross-references (see splitting rules in Step 4).

### 5. If any check fails

Fix the handoff before proceeding. Rewrite the thin sections. You have ~25% context remaining — use it.

---

## Steps 5 + 6: Update Beads & Persist Memory (PARALLEL)

**Run these in parallel** — they are independent writes. Launch as parallel Bash calls (no need for full agents here, these are single commands each):

**Beads update** (if beads available and tasks are in_progress):
```bash
bd update {id} --notes "Handoff written. See {file_path}"
```

**Memory persist** (if `bd remember` available):
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
     Bead(s): {bead_ids or "none"}

     Generated with [Claude Code](https://claude.ai/code)

     Co-Authored-By: Claude <noreply@anthropic.com>
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
   Read `{path to file}` (seq {N}, {chain_tag}) and continue from "Where We're Going". Check `bd list --status=in_progress` for active work.

   Before starting work, narrate your onboarding:
   1. Read the handoff file and summarize what you understand (goal, current state, what was tried)
   2. Show which bead(s) you're claiming and what phase/step you're starting
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
