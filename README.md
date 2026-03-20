# claude-handoff

**Never lose context between AI coding sessions.**

Session handoff skills for [Claude Code](https://claude.ai/code) that capture decisions, failed approaches, measurements, and next steps — so your next session picks up exactly where you left off. Save context, use fewer tokens, and stop wasting 20-40% of each session rediscovering what was already tried.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude_Code-compatible-blueviolet.svg)](https://claude.ai/code)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

## Install

```bash
git clone https://github.com/REMvisual/claude-handoff.git
cp -r claude-handoff/skills/handoff ~/.claude/skills/
cp -r claude-handoff/skills/handoffplan ~/.claude/skills/
```

Verify: open Claude Code and type `/handoff` — it should appear in autocomplete.

## Usage

```
/handoff              # Capture session context into a structured file
/handoffplan          # Capture context + generate an implementation plan
```

No arguments needed. The skill mines your full conversation, gathers git state, validates the output, and gives you a ready-to-paste resume prompt:

```
Read `plans/handoffs/HANDOFF_fix-auth-bug_2026-03-19.md` (seq 2, PROJ-abc1)
and continue from "Where We're Going".
```

Paste that into a fresh Claude Code session. It picks up the chain and starts working.

## What you get

Every handoff captures a structured snapshot of your session:

```
┌─────────────────────────────────────────────────────┐
│  HANDOFF_fix-auth-bug_2026-03-19.md                 │
├─────────────────────────────────────────────────────┤
│  The Goal           — what we're solving and why    │
│  Where We Are       — 15-25 bullets of current state│
│  What We Tried      — every approach, chronological │
│  Key Decisions      — what was chosen AND rejected  │
│  Evidence & Data    — real numbers, not summaries   │
│  Where We're Going  — ordered next steps            │
│  Quick Start        — exact commands for next session│
└─────────────────────────────────────────────────────┘
```

**"What We Tried" is the most valuable section.** Failed approaches are the single most expensive thing to rediscover across sessions. This section captures every attempt — what was tried, what happened, and why it was kept or abandoned — so the next session never repeats work.

See [`examples/`](examples/) for full sample handoff and plan files.

## How it works

### `/handoff` — Context capture

The core skill. When you run `/handoff`, it:

1. **Mines your conversation** using a 12-item checklist — goals, work completed, approaches tried, failed approaches, test results, decisions made, discoveries, code analysis, user preferences, remaining questions, and dependencies
2. **Gathers external state** — git log, diff, uncommitted changes, active tasks from your tracker
3. **Detects chain continuity** — finds prior handoffs in the same work stream via task IDs, inherits the chain tag and sequence number
4. **Checks for stale references** — verifies that code identifiers from prior handoffs still exist in the codebase
5. **Writes a validated file** — enforces line minimums (150+ for real sessions) and data completeness. If the first pass is too thin, it goes back and mines deeper
6. **Generates a resume prompt** — a paste-ready one-liner for the next session

Output: `HANDOFF_{slug}_{date}.md` in `plans/handoffs/` or `.claude/handoffs/`

### `/handoffplan` — Context capture + action plan

Runs the full `/handoff` first, then writes a paired implementation plan:

- **Phased steps** grounded in session evidence — every phase traces to findings from the handoff
- **Anti-goals** — what NOT to do, pulled from failed approaches and rejected alternatives
- **Rollback strategy** per phase — what to revert if things get worse
- **Success criteria** with baseline numbers from the handoff data

Output: `PLAN_{slug}_{date}.md` paired with the handoff file

### PreCompact hook — Safety net

A lightweight shell script that runs before context compaction, capturing ~50 lines of active tasks, recent commits, and uncommitted changes. Not a replacement for `/handoff` — a fallback so you never lose orientation completely.

### Chain tracking

Handoffs link across sessions via task or issue IDs:

```
HANDOFF_fix-auth_2026-03-17.md  (seq 1)
    └→ HANDOFF_fix-auth_2026-03-18.md  (seq 2, parent: seq 1)
        └→ HANDOFF_fix-auth_2026-03-19.md  (seq 3, parent: seq 2)
```

Your third session on a feature knows about the first two. The resume prompt carries the chain tag and sequence number, so detection is automatic.

### Self-validation

Every handoff runs through quality checks before it's written:

| Session type | Minimum lines | Target range |
|---|---|---|
| Light (quick fix) | 80 | 80–120 |
| Medium (multi-step) | 120 | 120–180 |
| Heavy (testing, data, pivots) | 150 | 180–300 |

If the draft is under the minimum, the skill re-mines the conversation and expands thin sections. Sessions over 300 lines split into cross-referenced parts.

## Integrations

Everything is optional. The skills work standalone and degrade gracefully.

- **Task trackers** — [beads](https://github.com/beads-project/beads), Linear, Jira, GitHub Issues, or any CLI tracker. Used for gathering active work context and updating task notes. The skill files use `bd` (beads) as a concrete example — swap in your tracker's CLI.
- **Memory systems** — any persistent recall tool. The skills search for prior context on the current work automatically when available.
- **Git** — `git log`, `git diff`, `git status` for state gathering. Runs automatically when git is available.

## Customization

Edit the skill files directly in `~/.claude/skills/handoff/skill.md`:

- **Line budgets** — adjust minimums and target ranges per session type
- **Output directory** — default priority: `plans/handoffs/` > `.claude/handoffs/`
- **Chain tag resolution** — adapt the logic to match your project's task ID scheme
- **Handoff template** — add or remove sections to fit your workflow

## PreCompact hook setup

```bash
cp claude-handoff/hooks/precompact-handoff.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/precompact-handoff.sh
```

Register as a `PreCompact` hook in your Claude Code settings. The script has no dependencies — it uses `git` and optionally your task tracker, skipping gracefully when unavailable.

## Uninstall

```bash
rm -rf ~/.claude/skills/handoff ~/.claude/skills/handoffplan
rm -f ~/.claude/hooks/precompact-handoff.sh
```

Handoff files in your projects are yours to keep or delete.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
