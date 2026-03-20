# claude-handoff

**Never lose context between AI coding sessions.**

Session handoff skills for [Claude Code](https://claude.ai/code) that capture everything — decisions, failed approaches, measurements, and next steps — so your next session picks up exactly where you left off.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude_Code-compatible-blueviolet.svg)](https://claude.ai/code)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## The Problem

Context windows are finite. Real work is not. Complex features, multi-day debugging sessions, and large refactors routinely span multiple Claude Code sessions. Every time a session ends, critical context vanishes: which approaches were already tried and failed, exact measurements and benchmarks, the reasoning behind architectural decisions, what was explicitly rejected and why.

The cost is not just lost notes — it is lost *negative knowledge*. Failed approaches are the single most expensive thing to rediscover. When your next session re-attempts an approach that was already tried, measured, and abandoned two sessions ago, you are burning 20-40% of your context window on ground that was already covered. Multiply that across a multi-session project and the waste compounds fast.

Manual notes are incomplete by nature. Copy-pasting raw chat transcripts is noisy and eats context on reload. Starting fresh and hoping the AI "figures it out" from code alone means losing every decision, every measurement baseline, and every lesson learned. You need a structured, validated, machine-readable handoff — not a chat log and a prayer.

**claude-handoff** solves this with two Claude Code skills that mine your conversation for every detail worth preserving, validate the output against quality thresholds, and produce a document that the next session can load in seconds.

## What This Does

### `/handoff` — Structured Session Capture

The core skill. Runs deep conversation mining and produces a validated handoff document.

- **12-item conversation mining checklist** — systematically extracts goals, work completed, approaches tried, failed approaches, test results, data files created, decisions made, discoveries, code analysis, user preferences, remaining questions, and dependencies
- **Self-validation with line minimums** — enforces a 150-line hard minimum for medium and heavy sessions (180-300 target range), with automatic re-mining when the first pass is too thin
- **Chain tracking across sessions** — links handoffs via task or issue IDs with sequence numbers, parent references, and prior chain breadcrumbs so you can trace a work stream across its full history
- **Multi-file splitting** — sessions exceeding 300 lines split into cross-referenced parts (state and goals in part 1, evidence and data in part 2)
- **Stale reference detection** — checks whether code identifiers mentioned in prior handoffs still exist in the codebase, flagging renames and removals before the next session trusts outdated names
- **Ready-to-paste resume prompt** — generates a one-liner you paste into your next session to pick up exactly where you left off, complete with chain tag and sequence number
- **PreCompact auto-handoff mode** — an emergency 50-line capture that fires automatically before context compaction, so you never lose state even if you forget to run `/handoff`

### `/handoffplan` — Implementation Plans Backed by Evidence

A thin orchestrator that runs `/handoff` first, then writes a phased implementation plan grounded in the session data.

- **Evidence-backed phases** — every phase traces back to findings from the handoff; no speculative plans disconnected from what was actually tried and measured
- **Anti-goals section** — explicitly lists what NOT to do, pulled from failed approaches and rejected alternatives, preventing the next session from repeating mistakes
- **Rollback plan per phase** — every phase includes what to revert if it makes things worse
- **Key findings with phase links** — conclusions from the session map directly to plan phases ("drives Phase N") showing the data-to-action connection
- **Task creation integration** — optionally creates tasks for each phase in your tracker (works with beads, Linear, Jira, GitHub Issues, or any CLI-based tracker)
- **Plan mode activation** — offers to enter Claude Code plan mode with the plan pre-loaded for immediate review and execution

## Quick Start

### Manual Install (Recommended)

```bash
git clone https://github.com/REMvisual/claude-handoff.git
cp -r claude-handoff/skills/handoff ~/.claude/skills/
cp -r claude-handoff/skills/handoffplan ~/.claude/skills/
```

### Optional: Install the PreCompact Hook

The PreCompact hook runs automatically before context compaction, capturing a lightweight snapshot of your project state as a safety net.

```bash
mkdir -p ~/.claude/hooks
cp claude-handoff/hooks/precompact-handoff.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/precompact-handoff.sh
```

Then register the hook in your Claude Code settings as a `PreCompact` hook.

### Verify Installation

Open Claude Code in any project and type `/handoff` — the skill should appear in autocomplete.

## Usage

### Creating a Handoff

When you are running low on context, wrapping up for the day, or pausing work on a task:

```
/handoff
```

That is it. No arguments required. The skill mines the entire conversation, gathers git state, checks for prior handoffs in the chain, writes a validated file, and gives you a paste prompt for the next session.

You can optionally pass a reason or context hint:

```
/handoff context low
/handoff end of day, picking up auth work tomorrow
```

The output is a structured Markdown file saved to `plans/handoffs/` (or `.claude/handoffs/`), with a descriptive filename like `HANDOFF_fix-bpm-drift_2026-03-19.md`.

### Creating a Handoff + Plan

When you want to capture session context AND produce an actionable implementation plan:

```
/handoffplan
```

This runs the full `/handoff` first, then writes a paired plan file (`PLAN_fix-bpm-drift_2026-03-19.md`) with phased steps, validation criteria, and rollback strategies — all grounded in the handoff data.

### Resuming in the Next Session

At the end of a handoff, you get a ready-to-paste prompt:

```
Read `plans/handoffs/HANDOFF_fix-bpm-drift_2026-03-19.md` (seq 3, myproject-1abc) and continue from "Where We're Going".
```

Paste that into a fresh Claude Code session. The next session reads the file, picks up the chain, and starts working immediately.

### Example Output

See the [`examples/`](examples/) directory for sample handoff and plan files.

## How It Works

**`/handoff`** is the workhorse. It runs a 12-item mining checklist across your full conversation history, gathers external state (git log, diff, task tracker), detects chain continuity from prior handoffs, validates the output against line minimums and data completeness checks, and writes one or more structured Markdown files. It is designed to run at ~75% context usage, when you have maximum conversation history to extract value from.

**`/handoffplan`** is a thin orchestrator. It calls `/handoff` first to produce the data file, then writes a separate plan file that references the handoff for evidence. The plan contains phased implementation steps, anti-goals, rollback strategies, and success criteria — all traceable to the handoff data. It never duplicates data; it points to it.

**`precompact-handoff.sh`** is an emergency safety net. It runs as a shell hook before context compaction, capturing a lightweight snapshot (~50 lines) of active tasks, recent commits, and uncommitted changes. It is not a substitute for a full `/handoff` — it is a fallback so you never lose orientation completely.

```
┌─────────────────────┐
│   /handoff           │  Deep context mining, self-validation, chain tracking
│   → HANDOFF_*.md     │  Produces the DATA file (150-300 lines)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   /handoffplan       │  Runs /handoff first, then writes action plan
│   → PLAN_*.md        │  Produces the ACTION file (120-250 lines)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   precompact hook    │  Emergency snapshot before context compaction
│   → HANDOFF_auto-*   │  Lightweight safety net (~50 lines)
└─────────────────────┘
```

## What a Handoff Looks Like

A typical handoff file follows this structure:

```markdown
# Fix BPM drift in onset detector

**Date:** 2026-03-19
**Status:** IN PROGRESS
**Bead(s):** myproject-1abc
**Epic:** BPM engine unification
**Chain:** `myproject-1abc` seq `3`
**Parent:** `HANDOFF_fix-bpm-drift_2026-03-18.md`
**Prior chain:** `HANDOFF_fix-bpm-drift_2026-03-17.md` > `HANDOFF_fix-bpm-drift_2026-03-18.md` > this

---

## The Goal

Eliminate BPM drift that causes visual stuttering in the live dashboard. The onset
detector accumulates timing error over 10+ minutes of continuous playback...

## Where We Are

- Modified `dsp_engine/onset.py` — replaced fixed threshold with adaptive median...
- Tests: 14 pass, 2 fail (edge cases with tempo changes > 20 BPM)
- Drift reduced from 156.6ms to 12.3ms over 10-minute window...
  (15-25 bullets for heavy sessions)

## What We Tried (Chronological)

1. **Fixed threshold at 0.3** — Worked for 4/4 techno but missed syncopated kicks...
2. **Adaptive median with 2.0x multiplier** — Better but too sensitive to hi-hats...
3. **Adaptive median with 3.0x multiplier** — Current approach, best results so far...
  (5-15 entries)

## Key Decisions

- Chose adaptive median over ML-based detection because latency budget is 5ms...
- Rejected Essentia library — licensing incompatible with MIT...
  (5-10 bullets)

## Evidence & Data

- Drift before: 156.6ms/10min, after: 12.3ms/10min (92% reduction)
- CPU usage: 2.1% → 2.4% (acceptable)...

## Where We're Going

1. Fix the 2 failing edge case tests (tempo change > 20 BPM)
2. Run full benchmark suite against the test corpus...

## Quick Start for Next Session

  # Key files to read first
  dsp_engine/onset.py
  tests/test_onset_drift.py

  # Verify current state
  pytest tests/test_onset_drift.py -v

  # Next action
  Fix tempo-change edge cases in adaptive_threshold()
```

## Optional Integrations

The skills are designed to work standalone — no external tools required. When integrations are available, they enhance the output automatically and degrade gracefully when absent.

### Task Trackers

The skills check for a task tracker CLI to gather active work context and update task notes after writing handoffs. The skill files use `bd` ([beads](https://github.com/beads-project/beads)) as a concrete example, but the pattern works with any CLI-based tracker:

- **beads** — `bd list`, `bd update`, `bd remember`
- **GitHub Issues** — `gh issue list`, `gh issue comment`
- **Linear** — `linear issue list`
- **Jira** — `jira issue list`

To adapt to your tracker, replace the `bd` commands in the skill files with your tracker's CLI equivalents.

### Memory Systems

If a persistent memory or recall tool is available, the skills use it to search for prior context on the current work — past decisions, failed approaches, related handoffs from earlier sessions. Any tool that supports keyword search works.

### Git

The skills use `git log`, `git diff`, and `git status` to capture recent commits, uncommitted changes, and branch state. This runs automatically when git is available.

## Customization

### Output Directory

Handoff files are written to the first available directory in this order:

1. `plans/handoffs/` — if a `plans/` directory exists in your project
2. `.claude/handoffs/` — fallback
3. Creates `plans/handoffs/` if neither exists

### Line Budgets

The default line targets are configured in the skill file (`skills/handoff/skill.md`):

| Session Type | Hard Minimum | Target Range |
|---|---|---|
| Light (quick fix) | 80 | 80-120 |
| Medium (multi-step) | 120 | 120-180 |
| Heavy (testing, data, pivots) | 150 | 180-300 |

Edit these thresholds in the skill file to match your preferences.

### Chain Tag Resolution

The chain tag identifies which work stream a handoff belongs to. Resolution order:

1. **Epic exists** — uses the epic name as the chain tag
2. **No epic, 1-4 tasks** — uses all task IDs
3. **No epic, 5+ tasks** — uses the 2-3 most relevant task IDs
4. **No tasks, no epic** — generates a standalone hex ID as fallback

Adapt the resolution logic in the skill file to match your project's identifier scheme.

### PreCompact Hook Registration

Register the hook in your Claude Code settings as a `PreCompact` event. The hook is a standalone shell script with no dependencies — it uses `git` and optionally `bd` if available, skipping gracefully when they are not.

## Uninstall

```bash
# Remove skills
rm -rf ~/.claude/skills/handoff ~/.claude/skills/handoffplan

# Remove hook (if installed)
rm -f ~/.claude/hooks/precompact-handoff.sh
```

Handoff files in your projects (`plans/handoffs/` or `.claude/handoffs/`) are yours to keep or delete.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on submitting issues and pull requests.

## License

MIT — see [LICENSE](LICENSE) for details.

---

Built for developers who refuse to lose context. If this saved you from rediscovering a failed approach, consider starring the repo.
