<p align="center">
  <img src="https://github.com/REMvisual/claude-handoff/releases/download/v1.6.0/banner.png" alt="claude-handoff" width="900"/>
</p>

**Never lose context between AI coding sessions.**

Two skills for [Claude Code](https://claude.ai/code) that capture decisions, failed approaches, measurements, and next steps — so your next session picks up exactly where you left off.

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

No arguments needed. The skill mines your conversation, gathers git state, validates the output, and gives you a paste prompt for the next session.

### `/handoff` — Context capture

Use when pausing mid-work. Captures what happened, what was tried, what failed, and what's next. The next session reads the handoff, onboards, and decides what to do.

### `/handoffplan` — Context capture + execution plan

Use when you've finished research or design and know what needs to be built. Writes the handoff AND a phased implementation plan with tracked tasks and dependencies. The next session reads the plan and starts coding Phase 1 immediately — no onboarding, no exploration.

### PreCompact hook

Optional safety net. A shell script that runs before context compaction, capturing ~50 lines of git state and active tasks. Not a replacement for `/handoff` — a fallback.

```bash
cp claude-handoff/hooks/precompact-handoff.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/precompact-handoff.sh
```

## Prevent skill shadowing

Without this, Claude may generate freeform "handoffs" when sessions end — documents that look right but lack chain tracking and validation. Add to your `CLAUDE.md`:

```markdown
When ending a session or saving progress:
- ALWAYS use the /handoff skill. NEVER generate handoff summaries without it.
```

## Uninstall

```bash
rm -rf ~/.claude/skills/handoff ~/.claude/skills/handoffplan
```

## License

[MIT](LICENSE) — If this saved you time, [give it a star](https://github.com/REMvisual/claude-handoff).
