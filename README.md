<p align="center">
  <img src="https://github.com/REMvisual/claude-handoff/releases/download/v1.6.0/banner.png" alt="claude-handoff" width="900"/>
</p>

**Never lose context between AI coding sessions.**

Two skills for [Claude Code](https://claude.ai/code) that capture decisions, failed approaches, measurements, and next steps — so your next session picks up exactly where you left off. Stop wasting 20-40% of each session rediscovering what was already tried.

**Now a Claude Code mod:** `/compact-handoff` writes the handoff, swaps the conversation for it, and keeps working in the same terminal. No new window, no paste. [Jump to the mod ↓](#compact-handoff-mod-experimental)

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

- **[Beads](https://github.com/gastownhall/beads)** — Issue tracking in your repo. Handoffs auto-detect active beads and use them as chain tags.
- **[OpenViking](https://github.com/volcengine/OpenViking)** — Persistent AI memory. Handoffs search for prior decisions and context from earlier sessions.
- **Git** — git log, diff, status gathered automatically.
- **Any CLI task tracker** — The skills use `bd` (beads) as default — swap in Linear, Jira CLI, or GitHub Issues.

## compact-handoff mod (experimental)

Runs the handoff, then **replaces the conversation with it and keeps going in the same terminal**, with no new session and no paste. It works like `/compact`, but the summary is your validated handoff.

```bash
claude plugin marketplace add REMvisual/claude-handoff
claude plugin install compact-handoff@claude-handoff
```

This also installs its small companion, `compact-handoff-answer` (see below). The skills above must be installed too, from v2.1.0 or later.

```
/compact-handoff [note]       # /handoff, then continue from "Where We're Going"
/compact-handoffplan [note]   # /handoffplan, then start executing Phase 1
/compact-handoff cancel       # drop a run that's stuck
```

What happens:

1. The skill runs in `compact-mode`: it asks nothing, commits the session's work, and writes the handoff (and plan).
2. When that turn ends, the mod checks the files on disk. If anything is missing, empty, interrupted or refused, **the context is left untouched**. It also counts the handoff's lines against the skill's minimum for the session's size (Chunked 500 lines from 500K tokens, Deep 300 from 100K). A short handoff gets one more turn to finish mining; still short, the context is left untouched.
3. The conversation is replaced by one short message naming the files. No summarizer call is made, so it takes milliseconds.
4. The skill's own paste prompt is sent automatically, so chain tracking continues (seq N+1).

The mod also shows a one-time toast when context passes 70%, suggesting `/compact-handoff`.

The model can't start a handoff on its own while the mod is installed: its own call to `/handoff` or `/handoffplan` is refused, and it tells you to run `/compact-handoff` or `/handoff` instead. A handoff you ask for (typing `/handoff`, or "do a handoff" in your own words) runs as usual.

**Why two plugins:** Claude Code doesn't let a plugin answer a compaction it started itself. `compact-handoff-answer` is about 20 lines. It answers only compactions marked `compact-handoff:v1` and leaves every other compaction alone.

**Caveats:**
- Experimental. The mod API is early access; tested on Claude Code 2.1.300.
- Where an organization manages Claude Code, compaction hooks from user-installed plugins don't run.
- Your own Stop and SessionStart hooks still run around the compaction, so slow ones add to the wait.
- Classic `PreCompact` hooks (including the one below) don't run on these compactions. `SessionStart` hooks with the `compact` matcher still do.

## PreCompact hook (optional)

Safety net that runs before context compaction, capturing ~50 lines of git state and active tasks.

```bash
cp claude-handoff/hooks/precompact-handoff.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/precompact-handoff.sh
```

## Uninstall

```bash
rm -rf ~/.claude/skills/handoff ~/.claude/skills/handoffplan
claude plugin uninstall compact-handoff@claude-handoff
claude plugin prune    # removes compact-handoff-answer, installed as its dependency
```

## License

[MIT](LICENSE) — If this saved you time, [give it a star](https://github.com/REMvisual/claude-handoff).
