# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2026-04-06

### Changed — `/handoffplan`
- **Removed plan mode dependency** — `/handoffplan` no longer enters Claude Code's built-in plan mode. Plan mode doesn't clear context as assumed, so the skill now commits and closes like `/handoff`, giving the next session full clean context for execution.
- **Execution paste prompt** — The paste prompt now tells the next session to read the plan, claim Phase 1, and start coding immediately — three prescribed actions, no onboarding or exploration. This is the key difference from `/handoff`: the next session executes, not explores.
- **Handoff quality gate** — Hard checkpoint between handoff and plan writing. If the handoff is under its tier minimum (500 lines for Tier 3), the skill stops and forces gap research expansion before proceeding. Previously this was a suggestion that got skipped.
- **Removed "plan mode" trigger** — The trigger phrase "plan mode" was hijacking Claude Code's built-in plan mode feature. Replaced with "handoff with a plan" and "create a plan and handoff".
- **Clearer skill identity** — Top-level description now explicitly states: this skill creates a plan for the NEXT session to execute. The handoff captures data, the plan defines work, beads track phases, then you close and hand off.

### Fixed — `/handoffplan`
- **Plan approved → session closed instead of executing** — In v1.5.0, after the user approved the plan, the assistant would close the session and write a paste prompt instead of executing Phase 1. This happened in 3/3 tested sessions across two different projects (CurveTool, VoidGram). Root cause: the `/handoff` skill's 50+ lines of close protocol overwhelmed the single-line "don't close" instruction. Fix: acknowledged that same-session execution after heavy Tier 3 mining is impractical (context exhausted), and redesigned the flow to always close with an execution-focused paste prompt.
- **Contradictory plan mode instructions** — Skill said "Do NOT enter plan mode at any point" (line 32) then later said "Enter plan mode" (Step 6). Fixed by removing plan mode entirely.
- **Beads not created** — Step 3 (create beads for phases) was skipped in the first failure case. The handoff quality gate and clearer step ordering address this.

### Added
- **Test case documentation** — `examples/FAILURE_curvetool-plan-not-executed_2026-04-01.md` and `examples/FAILURE_voidgram-plan-not-executed_2026-04-06.md` document the exact failure mode with transcripts, root cause analysis, and what was fixed. `examples/v1-output/` preserves the v1 handoff and plan output for comparison.

### Changed — README
- **`/handoffplan` section expanded** — Now explains the difference from `/handoff`: after `/handoff` the next session explores, after `/handoffplan` the next session executes Phase 1 immediately.
- **Stack diagram updated** — Added Handoffplan as its own line: "defines HOW to continue (phased plan, tasks, execution prompt)".

## [1.5.0] - 2026-04-01

### Added
- **Anti-shadowing guard** — Skill now explicitly instructs Claude to never generate freeform handoff-like documents without invoking `/handoff`. Prevents "skill shadowing" where Claude improvises session summaries that borrow handoff vocabulary but lack chain tracking, self-validation, and comprehension gates.
- **Expanded onboarding protocol** — Resume prompt now includes step 4: "explore 2-3 adjacent files not listed in the handoff." A/B testing showed the skill-based session missed a real bug (JWT secret mismatch) because it trusted the handoff's key files list exclusively. New step encourages exploration beyond listed files.
- **Key files annotation** — Quick Start template now marks key files as "not exhaustive — explore adjacent code too" to set expectations.
- **Comparison documentation** — `docs/COMPARISON_skill-vs-internal-handoff.md` with full A/B test data: same bug, same codebase, two sessions, one with skill handoff and one with Claude's auto-generated session summary. Evidence for the skill's value proposition.
- **Setup guide for skill shadowing prevention** — README section with recommended `CLAUDE.md` snippet to catch cases where Claude generates freeform handoffs without invoking any skill.

### Validated
- Controlled A/B test: skill session proposed architecturally superior fix (server-side token store vs cookie band-aid), self-gated without user intervention, maintained chain awareness. Internal session found more bugs through aggressive exploration but required user intervention and proposed a weaker fix.

## [1.4.0] - 2026-03-21

### Added
- **Two-phase write process** — Phase 1 writes the handoff, Phase 2 reads it back and does gap research to expand with uncaptured evidence tables, measurements, and data. Mandatory for Tier 2+3. Breaks through the ~420-line single-Write generation ceiling.
- **Parent cross-referencing** — "Since Last Handoff" section compares parent's plan vs what actually happened, answers parent's open questions, notes trajectory shifts
- **Reference document scanning** — auto-detects project bibles, architecture docs, CLAUDE.md and lists them with descriptions
- **Raised ceilings** — Extended target: 500-800 (was 300-600), Tier 3 target: 800, split at 800

### Changed
- Target the CEILING, not the floor — instructions now say "aim for 800" rather than "minimum 450"
- Standard target raised to 300-400 (was 180-300)

### Validated
- 7 A/B test iterations on a 550K-token session. V7 (two-phase): 536 lines, 43 sections, 149 table rows, 88% data retention vs baseline. Phase 2 gap research added 91 lines of evidence tables.

## [1.3.0] - 2026-03-21

### Added
- **Tiered context mining** — automatically selects extraction strategy based on context size:
  - Tier 1 (<100K): single checklist pass
  - Tier 2 (100-500K): two passes with middle-content gap-fill
  - Tier 3 (500K+): map-reduce with per-chunk extraction, merge, and validation pass
- **Mandatory tier announcement** — agent must declare "Mining at Tier N (reason)" before starting extraction
- **Required "User Feedback & Preferences" section** — never omitted, captures the user's voice (corrections, frustrations, feature requests, process preferences)
- **Raw data inlining** — Evidence section now includes small data blocks (<20 lines) like ground truth annotations and reference configs inline, not just by path reference
- **Tier 3 line floor (450)** — massive sessions cannot be captured under 450 lines. Validation check enforces this and sends agent back to mine deeper if under floor

### Fixed
- **Premature file splitting** — agents were pre-splitting into "narrative" + "evidence" files even under the 600-line threshold. Now enforces ONE file, ONE Write call, no exceptions under threshold
- **Trigger substring matching** — removed triggers containing "close this session" and "wrap up session" that fuzzy-matched casual conversation
- **Validation check location** — Tier 3 floor was in mining instructions (Step 1C) but agent checked against Step 4 table. Moved floor override directly into Step 4-CHECK

### Validated
- 5 A/B test iterations on the same 550K-token session. Final version (V5): single file, 448 lines, 17 sections, user feedback restored, evidence tables present, Tier 3 announced and floor enforced

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
