# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-03-20

### Fixed
- **PreCompact hook** now actually fires — merged two hook entries that were blocking each other due to empty-matcher routing bug. The auto-handoff script had never executed in months of use.

### Changed
- **Skill slimmed 21%** (601 → 477 lines) — removed duplicate line budget tables, compressed agent descriptions into tables, shortened template guidance, deleted redundant Rules section. ~1,000 fewer tokens per `/handoff` invocation.

## [1.1.1] - 2026-03-20

### Added
- "Works great with" section in README featuring Beads + OpenViking recommended stack
- Safer trigger phrases: "close/wrap up session with a handoff", "hand off this session"
- 1M Extended limits in README self-validation table

### Fixed
- Removed ambiguous triggers that fired on casual mentions of "handoff"

## [1.1.0] - 2026-03-20

### Added
- **Parallel agent teams** — Step 1A (external state), Step 1B-3/1B-4 (prior context + stale ref check), and Steps 5+6 (beads + memory) now explicitly dispatch as parallel subagents. New "Agent Strategy" section at top of handoff skill.
- **Model-aware line limits** — 1M context models get Extended limits (target 300-600 lines, split at 600) vs Standard 200K limits (180-300, split at 300). Auto-detected from system prompt.
- **Trigger guard** — Handoff skill no longer fires when merely _discussing_ handoffs. Bare "handoff" trigger removed; replaced with intent-specific phrases. Guard clause asks for confirmation on ambiguous triggers.
- **Extended precompact hook** — Captures more data (25 beads, 15 commits, git status section, high-priority open work) for better safety nets on large context models.

### Changed
- Trigger list tightened: `handoff` → `do a handoff`, `save context` → `save session context`, `save progress` → `save session progress`, added `close this session`
- Precompact hook source path fixed (`~/.claude/scripts/` not `~/.claude/hooks/`)
- All line budget references updated with dual Standard/Extended columns

## [1.0.0] - 2026-03-19

### Added
- `/handoff` skill — structured session handoff with deep context mining, self-validation, chain tracking, and multi-file splitting
- `/handoffplan` skill — evidence-backed implementation plan generator that pairs with handoff files
- PreCompact auto-handoff hook — safety net before context compaction
- One-liner install script
- Example handoff and plan files
