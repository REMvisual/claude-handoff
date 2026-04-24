<p align="center">
  <img src="https://github.com/REMvisual/claude-handoff/releases/download/v1.6.0/banner.png" alt="claude-handoff" width="900"/>
</p>

**Never lose context between AI coding sessions.**

Two skills for [Claude Code](https://claude.ai/code) that capture decisions, failed approaches, measurements, and next steps — so your next session picks up exactly where you left off. Stop wasting 20-40% of each session rediscovering what was already tried.

[![Download Latest](https://img.shields.io/github/v/release/REMvisual/claude-handoff?style=for-the-badge&label=Download&color=blue)](https://github.com/REMvisual/claude-handoff/releases/latest)

## Install

```bash
git clone https://github.com/REMvisual/claude-handoff.git
cp -r claude-handoff/skills/handoff ~/.claude/skills/
cp -r claude-handoff/skills/handoffplan ~/.claude/skills/
```

Verify: type `/handoff` in Claude Code — it should appear in autocomplete.

## Usage

```
/handoff              # Capture session context — next session explores
/handoffplan          # Capture context + write a plan — next session executes
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
│  User Feedback      — preferences, corrections, tone│
│  Where We're Going  — ordered next steps            │
│  Quick Start        — exact commands for next session│
└─────────────────────────────────────────────────────┘
```

**"What We Tried" is the most valuable section.** Failed approaches are the most expensive thing to rediscover. This section captures every attempt — what was tried, what happened, why it was kept or abandoned — so the next session never repeats work.

## `/handoff` vs `/handoffplan`

Both capture your session. The difference is what the **next session** does:

| | `/handoff` | `/handoffplan` |
|---|---|---|
| **When to use** | Pausing mid-work | Done with research, ready to build |
| **What it writes** | Handoff file | Handoff + phased plan + tracked tasks |
| **Next session** | Reads handoff, onboards, explores | Reads plan, claims Phase 1, starts coding |
| **Paste prompt** | "Continue from Where We're Going" | "Execute the plan starting at Phase 1" |

`/handoffplan` creates beads (or tasks in your tracker) with dependency chains between phases, anti-goals from failed approaches, rollback strategies, and success criteria tied to real numbers from the session.

## How it works

1. **Mines your conversation** — 12-item extraction checklist covering goals, approaches, failures, decisions, measurements, code analysis, and user preferences
2. **Gathers external state** — git log, diff, uncommitted changes, active tasks (in parallel)
3. **Detects chain continuity** — finds prior handoffs in the same work stream, inherits chain tag and sequence number
4. **Validates the output** — Phase 1 must hit the pass minimum on first write; Phase 2 then fills gaps toward the ceiling
5. **Adapts to context size** — at 500K+ tokens, switches to multi-pass map-reduce extraction to avoid the "lost in the middle" problem

Handoffs link across sessions automatically:

```
HANDOFF_fix-auth_2026-03-17.md  (seq 1)
    └─ HANDOFF_fix-auth_2026-03-18.md  (seq 2)
        └─ HANDOFF_fix-auth_2026-03-19.md  (seq 3)
```

Your third session on a feature knows about the first two.

## Why this exists

Claude already generates session summaries when context compresses. They look like handoffs — but they lack chain tracking, self-validation, evidence mining, and comprehension gates. In controlled A/B testing (same bug, same codebase, fresh sessions), the skill-based session:

- Required **zero user intervention** (the unstructured session needed "don't alter anything yet")
- Traced the **complete failure call chain** (the unstructured session proposed a surface-level fix)
- Found **bugs not listed in the handoff** through structured adjacent exploration
- Produced **justified fixes** instead of correct-but-unexplained ones

## Prevent skill shadowing

Without this, Claude may generate freeform "handoffs" when sessions end — documents that look right but skip the process. Add to your `CLAUDE.md`:

```markdown
When ending a session or saving progress:
- ALWAYS use the /handoff skill. NEVER generate handoff summaries without it.
```

## Works with

The skills work standalone. They unlock more when paired with:

- **[Beads](https://github.com/beads-project/beads)** — Issue tracking in your repo. Handoffs auto-detect active beads and use them as chain tags.
- **[OpenViking](https://github.com/openviking/openviking)** — Persistent AI memory. Handoffs search for prior decisions and context from earlier sessions.
- **Git** — git log, diff, status gathered automatically.
- **Any CLI task tracker** — The skills use `bd` (beads) as default — swap in Linear, Jira CLI, or GitHub Issues.

## PreCompact hook (optional)

Safety net that runs before context compaction, capturing ~50 lines of git state and active tasks.

```bash
cp claude-handoff/hooks/precompact-handoff.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/precompact-handoff.sh
```

## Uninstall

```bash
rm -rf ~/.claude/skills/handoff ~/.claude/skills/handoffplan
```

## License

[MIT](LICENSE) — If this saved you time, [give it a star](https://github.com/REMvisual/claude-handoff).
