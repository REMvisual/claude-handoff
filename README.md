# claude-handoff

**Never lose context between AI coding sessions.**

Session handoff skills for [Claude Code](https://claude.ai/code). Captures decisions, failed approaches, measurements, and next steps — so your next session picks up where you left off.

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

No arguments needed. The skill mines your full conversation, gathers git state, validates the output, and gives you a paste prompt for the next session:

```
Read `plans/handoffs/HANDOFF_fix-auth-bug_2026-03-19.md` (seq 2, PROJ-abc1) and continue from "Where We're Going".
```

Paste that into a fresh session. Done.

## What you get

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

"What We Tried" is the most valuable section — failed approaches are the most expensive thing to rediscover.

See [`examples/`](examples/) for full sample files.

## How it works

| Skill | What it does | Output |
|---|---|---|
| `/handoff` | Deep conversation mining, self-validation, chain tracking | `HANDOFF_*.md` (150-300 lines) |
| `/handoffplan` | Runs `/handoff`, then writes evidence-backed plan | `PLAN_*.md` (120-250 lines) |
| PreCompact hook | Emergency snapshot before context compaction | `HANDOFF_auto-*.md` (~50 lines) |

**Chain tracking** links handoffs across sessions via task IDs and sequence numbers. Your third session on a feature knows about the first two.

**Self-validation** enforces line minimums and data completeness checks. If the handoff is too thin, it re-mines the conversation.

## Optional extras

**PreCompact hook** — auto-captures state before context compaction:
```bash
cp claude-handoff/hooks/precompact-handoff.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/precompact-handoff.sh
# Register as a PreCompact hook in Claude Code settings
```

**Task tracker integration** — works with [beads](https://github.com/beads-project/beads), Linear, Jira, GitHub Issues, or any CLI tracker. The skills use `bd` as a concrete example and degrade gracefully without it.

**Memory systems** — if a persistent recall tool is available, the skills search for prior context automatically.

## Customization

Edit the skill files directly in `~/.claude/skills/handoff/skill.md`:
- **Line budgets** — adjust minimums and targets per session type
- **Output directory** — defaults to `plans/handoffs/` > `.claude/handoffs/`
- **Chain tags** — adapt the resolution logic to your project's ID scheme

## Uninstall

```bash
rm -rf ~/.claude/skills/handoff ~/.claude/skills/handoffplan
rm -f ~/.claude/hooks/precompact-handoff.sh
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
