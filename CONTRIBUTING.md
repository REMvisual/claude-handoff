# Contributing to claude-handoff

## How to contribute

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test by installing locally: copy files to `~/.claude/skills/` and run `/handoff` in Claude Code
5. Submit a pull request

## What makes a good contribution

- Bug fixes in the skill logic or install script
- New optional integration points (task trackers, memory systems)
- Improvements to the handoff template that make handoffs more useful
- Documentation improvements

## What we probably won't merge

- Changes that make any external tool a hard dependency
- Removing the self-validation step
- Changes that reduce handoff quality (lower line minimums, removing sections)
- Adding Claude Code plan mode as a dependency for the handoff skill

## Testing

There is no automated test suite. Testing means:
1. Install the skills locally
2. Have a real Claude Code session with meaningful work
3. Run `/handoff` and verify the output captures your session accurately
4. Run `/handoffplan` and verify the plan references the handoff data

## Style

- Skills are written in markdown with embedded bash
- Tone is direct and practical
- Every instruction must be actionable by Claude Code without human intervention
