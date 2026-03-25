# claude-handoff: v1.0.0 → v1.4.1 — Skill Engineering, A/B Testing, Community Launch

**Date:** 2026-03-20 to 2026-03-25
**Status:** COMPLETED (v1.4.1 shipped, community PRs open)
**Bead(s):** none (home directory, no project beads)
**Epic:** claude-handoff open source skill
**Chain:** `standalone-handoff-skill` seq `1`
**Parent:** `none — first in chain`
**Prior chain:** none — first in chain

---

## Reference Documents

- `~/.claude/skills/handoff/skill.md` — The local handoff skill (private, project-specific refs)
- `C:\Standalone\claude-handoff\` — Public repo (genericized via sync script)
- `~/.claude/scripts/sync-handoff-to-github.sh` — Sync script with genericization transforms
- `~/.claude/skills/handoffplan/skill.md` — Paired plan skill
- `~/.claude/scripts/precompact-handoff.sh` — PreCompact auto-handoff hook
- `~/.claude/projects/C--Users-SIMANGO/memory/handoff_v5_testing.md` — A/B test lessons
- `~/.claude/projects/C--Users-SIMANGO/memory/claude_handoff_release.md` — Release tracking
- `~/.claude/projects/C--Users-SIMANGO/memory/claude_handoff_prs.md` — PR tracking

## The Goal

Engineer the handoff skill from a basic context-capture tool into a production-grade session transfer system that handles massive (500K+) context windows, preserves all evidence and user feedback, and is available publicly for the Claude Code community. The skill went from v1.0.0 (initial release) through 7 A/B test iterations to v1.4.1, solving: premature file splitting, lost-in-the-middle data, missing user feedback, evidence under-capture, accidental trigger firing, and broken PreCompact hooks.

## Where We Are

- **Public repo:** https://github.com/REMvisual/claude-handoff — v1.4.1 tagged and released
- **GitHub topics:** claude-code, claude-code-skills, claude-skills, session-handoff, ai-coding-agent, developer-tools, anthropic-claude, agentic-ai
- **Skill size:** 477 lines (slimmed from 601, then grew to ~520 with new features)
- **PreCompact hook:** Fixed — was never firing due to matcher routing bug. Now both `bd prime` and `precompact-handoff.sh` run on every compaction
- **Triggers:** Tightened from 11 to 7. Removed bare "handoff", "close this session", "wrap up session". Added trigger guard clause.
- **Tiered mining:** Tier 1 (<100K single pass), Tier 2 (100-500K two-pass), Tier 3 (500K+ map-reduce)
- **Two-phase write:** Phase 1 writes ~350-450 lines, Phase 2 gap research adds ~90-150 via Edit
- **Line targets:** Extended ceiling raised to 800 (was 600), Tier 3 minimum 500
- **Required sections:** User Feedback & Preferences (REQUIRED — never omit), Since Last Handoff (when parent exists), Reference Documents (bible scanning)
- **Parent cross-referencing:** Agent reads full parent handoff and compares plan vs reality
- **Evidence guidance:** Explicit list of required data types + raw data inlining for blocks <20 lines
- **handoffplan:** Updated to require full two-phase write process, not abbreviated handoff
- **Happy attribution:** Removed from public repo, genericization rules strip it on sync
- **Sync script:** `~/.claude/scripts/sync-handoff-to-github.sh` — genericizes Audiophile refs, OV refs, Happy refs, BPM error refs

### Community Launch
- **Beads ecosystem PR:** MERGED by Steve Yegge into `docs/COMMUNITY_TOOLS.md` (commit 5d958d16)
- **5 awesome list PRs:** 4 open (ComposioHQ, jqueryscript, travisvn, rohitg00), 1 closed (hesreallyhim — requires issue template, 7-day cooldown)
- **Beads Discussion:** Posted (session handoff + context quality on 1M windows)
- **OpenViking Discord:** Posted (referenced merged PR #798, showed handoff integration)
- **README:** "Works great with" section featuring Beads + OpenViking recommended stack with links and architecture diagram

## What We Tried (Chronological)

1. **1M context model-aware limits (v1.1.0)** — Added Extended column to line budget table. Standard 180-300, Extended 300-600. WORKED but later raised to 500-800.

2. **Parallel agent teams (v1.1.0)** — Added Agent Strategy section, restructured Steps 1A and 1B-3/4 to use parallel agents. WORKED — agent dispatches correctly when instructed.

3. **Trigger safety (v1.1.0-v1.1.1)** — Removed bare "handoff" trigger that matched any mention. Added trigger guard clause. Tightened trigger list across 3 iterations. Removed "close this session" and "wrap up session" after Voidgram false positive. MOSTLY WORKED — superpowers framework still occasionally matches on "close this session" via 1% rule, but trigger guard catches most cases.

4. **PreCompact hook fix (v1.2.0)** — Discovered hook had NEVER fired across months of use. Root cause: empty matcher `""` in settings.json caught all compaction events, preventing the `"auto"` matcher's script from executing. Fix: merged both commands into single entry. VERIFIED via agent checking debug logs — zero auto-handoff files ever existed.

5. **Skill slimming (v1.2.0)** — Cut from 601 to 477 lines (21%). Removed: duplicate line budget table from validation, verbose agent descriptions (replaced with tables), expanded template guidance (compressed to 1-2 lines), 20-rule Rules section (all duplicated earlier steps). WORKED but over-compressed Evidence guidance — had to restore it.

6. **A/B testing on 550K token Audiophile session (v1.2.0→v1.4.0)** — 7 iterations comparing handoff output quality. Key findings per version:
   - V1 POST (356 lines): Slimmed skill lost all evidence tables. Evidence guidance too terse.
   - V2 TIERED (454 lines, split): Tier 3 announced, 17 "What We Tried" entries, 7 tables. Best quality but SPLIT into part1+part2 despite being under 600.
   - V3 ONEWRITE (353 lines): No split, but dropped entire User Feedback section (0 items). One-write constraint caused self-limiting.
   - V4 FEEDBACK (362 lines): User feedback section restored (15 items). But under 450 floor — agent referenced old 300 minimum instead of Tier 3 floor.
   - V5 FLOOR (448 lines): Floor check enforced — agent caught itself at 376, expanded to 448 via Update. First successful self-correction.
   - V6 CROSSREF (416 lines): Since Last Handoff + Reference Docs sections work. But floor check skipped again (416 < 450).
   - V7 TWOPHASE (536 lines): TWO-PHASE WRITE breakthrough. Phase 1: 445 lines. Phase 2 gap research: +91 lines of evidence tables. 88% data retention vs baseline.

7. **Premature file splitting (3 attempts to fix)** — Agent kept writing part1 then part2 even under threshold. "ALWAYS write a single file" wasn't enough — agent treated the narrative/evidence split description as structural guidance. Fixed with "ONE FILE. ONE WRITE. NO EXCEPTIONS" — had to block the two-Write-call pattern explicitly. FINALLY WORKED on V3+.

8. **Tier 3 floor placement** — Floor instruction was in Step 1C (mining section), but agent validated against Step 4 table (300 minimum). Moved floor override directly into Step 4-CHECK's Line Count Check. WORKED on V5.

9. **Required User Feedback section** — V3 dropped all 12 user feedback items when section was optional. Added "(REQUIRED — never omit)" to template heading with explicit guidance on what to capture. WORKED on V4+.

10. **Evidence guidance restoration** — Compressed one-liner lost 10 evidence sections vs baseline. Restored to explicit list: comparison tables, cost tracking, iteration histories, status matrices, commit logs, raw data blocks. WORKED — V5+ had 7-9 tables.

11. **Parent cross-referencing (v1.4.0)** — Added "Since Last Handoff" section comparing parent's plan vs reality. Agent reads full parent file and answers parent's open questions. WORKED on V6+.

12. **Bible/reference doc scanning (v1.4.0)** — New "Reference Documents" section auto-detects BIBLE files and CLAUDE.md. WORKED on V6+ (found 6 docs in Audiophile).

13. **Two-phase write (v1.4.0)** — Phase 1 Write + Phase 2 gap research via Edit. Breaks through ~420 line generation ceiling. WORKED on V7 (445→536). Key insight: model has a practical single-Write generation limit of ~420 lines.

14. **Raised ceilings (v1.4.0)** — Extended target raised to 500-800 (was 300-600). Tier 3 minimum 500. Standard target raised to 300-400. Instruction changed to "target the CEILING, not the floor."

15. **handoffplan two-phase enforcement** — handoffplan was skipping Phase 2 gap research (309 lines). Added explicit instruction requiring full two-phase process. Improved to 412 lines but still under 500 — behavioral gap where agent rushes to write the plan.

16. **Community PRs** — 6 submitted, 1 merged (Beads), 4 open, 1 closed (hesreallyhim requires issue template). ComposioHQ review caught `n-` typo from sed `\n-` insertion. rohitg00 review questioned install path — clarified `~/.claude/skills/handoff` is intentional.

17. **Happy attribution removal** — Removed from public skill, added genericization rules to sync script, rewrote entire git history with filter-branch to remove Co-Authored-By trailers. Force-pushed. GitHub contributor cache took time to update.

## Key Decisions

1. **Two-phase write > single-write** — Model has a ~420 line practical generation ceiling per Write call. Two-phase (Write + Edit) breaks through it. A/B testing proved it: V7 at 536 lines vs V3 at 353.

2. **Target ceiling, not floor** — Instructions saying "minimum X" led to agents writing exactly X and moving on. Changed to "target the CEILING" (800 for extended). Agents still undershoot but produce more.

3. **Constraints must be at decision points** — Tier 3 floor in Step 1C (mining) was ignored because the agent checked Step 4 table (validation). Moved floor to Step 4-CHECK. Same pattern for all constraints: put them WHERE the agent looks, not where you explain WHY.

4. **User Feedback is non-negotiable** — V3 dropped all 12 feedback items when section was optional. It's the user's voice — calibrates the next session's approach. Marked REQUIRED.

5. **Don't gitignore handoff files** — Considered but rejected. Handoffs are project context that teams may want tracked. Archive mechanism handles clutter. One-liner gitignore available for those who want it.

6. **No TaskCreate fallback without beads** — TaskCreate is conversation-scoped (disappears on close). Beads persist across sessions. The skill degrades gracefully without beads — standalone hex chain tag, no bead updates. Adding TaskCreate would just duplicate the markdown checklist.

7. **Accept ~420 as single-Write ceiling** — Rather than fighting the generation limit, work with it. Phase 2 Edit is the natural solution. This is a model-level constraint, not a skill design issue.

8. **Leave trigger false positives** — Superpowers framework's "1% chance = invoke" rule causes occasional false triggers on "close this session". Trigger guard catches most. Further negative examples are whack-a-mole with diminishing returns.

9. **Sync script genericization > manual cleanup** — sed rules auto-strip Audiophile, OV, Happy, BPM error references. New catch-all pattern `Audiophile-[a-z0-9]{4}` handles all bead ID variants.

10. **PreCompact: merge hooks, don't fix matcher** — Rather than debugging Claude Code's matcher routing bug, merged both commands into one hook entry. Pragmatic fix that works regardless of matcher behavior.

## Evidence & Data

### A/B Test Results (7 iterations, same 550K session)

| Version | Lines | Split? | Tier? | Phase 2? | User feedback | Tables | Retention |
|---------|-------|--------|-------|----------|---------------|--------|-----------|
| Baseline (old skill) | 443 | Yes (merged) | No | No | 12 | 9 | 100% |
| V1 POST | 356 | No | No | No | 15 | 5 | ~65% |
| V2 TIERED | 454 (split) | Yes | Yes | No | 15 | 11 | ~80% |
| V3 ONEWRITE | 353 | No | Yes | No | 0 | 9 | ~60% |
| V4 FEEDBACK | 362 | No | Yes | No | 15 | 4 | ~70% |
| V5 FLOOR | 448 | No | Yes | Yes (376→448) | 18 | 9 | 76% |
| V6 CROSSREF | 416 | No | Yes | No | 16 | 7 | ~75% |
| V7 TWOPHASE | 536 | No | Yes | Yes (445→536) | 16 | 7+ | 88% |

### Release History

| Version | Date | Key Feature | Commits |
|---------|------|-------------|---------|
| v1.0.0 | 2026-03-19 | Initial release | — |
| v1.1.0 | 2026-03-20 | Agent teams, 1M limits, trigger guard | 1 |
| v1.1.1 | 2026-03-20 | Beads+OV README, safer triggers | 1 |
| v1.2.0 | 2026-03-20 | PreCompact fix, slimmed 21% | 1 |
| v1.3.0 | 2026-03-21 | Tiered mining, required feedback, floor | 8 |
| v1.4.0 | 2026-03-21 | Two-phase write, parent cross-ref, raised ceilings | 4 |
| v1.4.1 | 2026-03-22 | Genericize example bead IDs | 1 |

### PR Status

| Target | PR | Status |
|--------|-----|--------|
| steveyegge/beads COMMUNITY_TOOLS | #2731 | MERGED |
| hesreallyhim/awesome-claude-code | #1028 | Closed (issue template required, 7-day cooldown) |
| jqueryscript/awesome-claude-code | #109 | Open |
| travisvn/awesome-claude-skills | #343 | Open |
| ComposioHQ/awesome-claude-skills | #446 | Open (review changes addressed) |
| rohitg00/awesome-claude-code-toolkit | #78 | Open (install path clarified) |

### Skill Line Count Evolution

| Version | Skill lines | Output lines (Tier 3 Audiophile) |
|---------|-------------|----------------------------------|
| v1.0.0 | 601 | 443 (baseline) |
| v1.2.0 | 477 (slimmed) | 356 (V1 POST) |
| v1.3.0 | ~490 | 448 (V5 FLOOR) |
| v1.4.0 | ~520 | 536 (V7 TWOPHASE) |

## Code Analysis

### Key files and what they do
- `~/.claude/skills/handoff/skill.md` — The skill. ~520 lines. Contains: triggers, trigger guard, agent strategy table, tiered mining (3 tiers), two-phase write process, handoff template with 17 sections, self-validation checks, session close flow
- `~/.claude/skills/handoffplan/skill.md` — Paired plan skill. Calls handoff first, then writes plan. Updated to require two-phase write.
- `~/.claude/scripts/sync-handoff-to-github.sh` — Sync local→public. Genericization: Audiophile bead IDs, OV→persistent memory, Happy co-author lines
- `~/.claude/scripts/precompact-handoff.sh` — Auto-handoff hook. Captures beads, git log/status/diff, writes ~50-80 line safety net
- `~/.claude/settings.json` — PreCompact hook entry (merged, both commands in single matcher)
- `C:\Standalone\claude-handoff\` — Public repo clone. README, CHANGELOG, install.sh, skills/, hooks/, examples/

### Critical thresholds
- Single-Write generation ceiling: ~420 lines (model limitation)
- Tier 3 minimum: 500 lines
- Tier 3 ceiling: 800 lines
- Extended split threshold: 800 lines
- Phase 2 gap research typically adds: 50-150 lines

## Files Changed

### Skills (modified)
- `~/.claude/skills/handoff/skill.md` — Major rewrite across 15+ iterations
- `~/.claude/skills/handoffplan/skill.md` — Two-phase write enforcement added

### Scripts (modified)
- `~/.claude/scripts/sync-handoff-to-github.sh` — Fixed hook source path, added Audiophile/Happy genericization rules
- `~/.claude/scripts/precompact-handoff.sh` — Extended capture limits (25 beads, 15 commits, git status section)

### Settings (modified)
- `~/.claude/settings.json` — PreCompact hook entries merged

### Public repo (C:\Standalone\claude-handoff\)
- `skills/handoff/skill.md` — Genericized version of local skill
- `skills/handoffplan/skill.md` — Genericized version
- `hooks/precompact-handoff.sh` — Public version of hook
- `README.md` — Added context tiers section, Beads+OV recommended stack, updated install instructions
- `CHANGELOG.md` — v1.1.0 through v1.4.1 entries

### Memory files (created/updated)
- `~/.claude/projects/C--Users-SIMANGO/memory/claude_handoff_release.md` — Updated to v1.4.1
- `~/.claude/projects/C--Users-SIMANGO/memory/claude_handoff_prs.md` — New, PR tracking
- `~/.claude/projects/C--Users-SIMANGO/memory/handoff_v5_testing.md` — New, A/B test lessons

### Test artifacts (deleted — in Audiophile project)
- 9 test files (BASELINE, V1-V7) cleaned up from `C:\Standalone\Audiophile\plans\handoffs\`

## User Feedback & Preferences (REQUIRED — never omit)

1. **"Make sure you differentiate between what should be noted as a bot and what shouldn't"** — When posting as the user (PRs, discussions), don't mention AI. When posting as automated (commits), include co-author.
2. **"Show me what you're going to post"** — Review community posts before submitting. User approves the text.
3. **"Make it a little bit shorter and direct"** — Beads Discussion post was too long. User prefers concise, direct community communications.
4. **"Close this session has nothing to do with the handoff"** — False trigger frustration. Led to trigger tightening.
5. **"Why are we splitting the files if it's under 400?"** — Split behavior was wrong. User caught it immediately.
6. **"Why do you think that's happening?"** — User actively debugs skill behavior with me, collaborative engineering approach.
7. **"Launch a shit ton of parallel work"** — User wants aggressive parallelization in handoffs and plans.
8. **"Be meticulous"** — User wants comprehensive handoffs, not summaries.
9. **"I don't think we need the test files"** — Clean up after A/B testing, don't leave artifacts.
10. **"Make sure we aren't degraded or lost any data"** — Quality verification is important. Compare across versions.
11. **"Is there anything else we can do on GitHub to get their attention?"** — User is proactive about community engagement and visibility.
12. **"Do they have discords?"** — User prefers direct community engagement over just PRs.
13. **"We should also do some parallel research"** — User values research-backed decisions, not guesswork.

## Where We're Going

1. **Monitor open PRs** — 4 awesome list PRs awaiting merge. ComposioHQ needs reviewer re-check. hesreallyhim resubmit via issue template after cooldown (~2026-03-27).
2. **Test handoffplan with two-phase** — v1.4.1's handoffplan fix hasn't been fully validated yet. 309→412 was progress but not at 500 target.
3. **Real-world observation** — Stop A/B testing the same session. Use the skill across projects and collect feedback naturally. The V7 two-phase pattern is proven.
4. **Consider v1.5.0** — If handoffplan validation or new findings warrant it. Otherwise wait for community feedback.
5. **Beads COMMUNITY_TOOLS update** — When there's a major feature worth re-PRing (not for point releases).

## Risks & Blockers

- **Superpowers false triggers** — "close this session" still occasionally matches. Accepted as low-impact annoyance.
- **handoffplan Phase 2 gap** — Agent still rushes through handoff to get to the plan. May need stronger enforcement.
- **GitHub contributor cache** — happy-otter may still show despite history rewrite. Should clear eventually.
- **hesreallyhim cooldown** — 7-day cooldown on account. Can resubmit via issue template after ~2026-03-27.

## Open Questions

1. Should the handoffplan produce a THICKER handoff by default (since the plan adds context the handoff doesn't need to duplicate)?
2. Is 800 lines the right Tier 3 ceiling, or should it be higher given the Write+Edit two-phase approach can go much further?
3. Should we add a "Beads Closed This Session" required section to the template? Baseline had it, later versions lost it.
4. Would a blog post (Dev.to / Hashnode) about the A/B testing methodology drive more adoption than awesome list PRs?

## Research Findings (from parallel agents)

### Lost-in-the-Middle Problem (academic research)
- Liu et al. 2024 (TACL): U-shaped attention curve, 30%+ accuracy drop for mid-context info
- Chroma "Context Rot" (2025): Even with 100% token recall, performance degrades — attention dilution + distractor interference
- Claude Opus 4.6: 93% retrieval at 256K, drops to 76-78% at 1M (MRCR v2 benchmark)
- Effective capacity is 60-70% of advertised max for extraction tasks
- JetBrains NeurIPS 2025: Map-reduce pattern validated for long-context extraction — enables short-context models to outperform 70B-scale models
- LangExtract (Google): Multi-pass with different focuses beats repeated general passes
- Practitioner consensus: handoff/compaction at 75-80%, not 95% when auto-compact fires

### PreCompact Hook Analysis (discovered dead code)
- Agent examined 22 debug sessions (Feb-Mar 2026)
- PreCompact fires 21 times with query "auto" but only `bd prime` executes (from empty matcher)
- precompact-handoff.sh had NEVER produced any output file across any project
- Zero `HANDOFF_auto-precompact*` files found anywhere
- Root cause: Claude Code hook matcher dedup/ordering bug — empty matcher catches all events

### sed n- Typo Bug
- `sed` with `\n-` on some platforms produces literal `n-` instead of newline + `-`
- Caused broken Markdown in ComposioHQ and Beads PRs
- Steve Yegge fixed it himself and merged directly
- Lesson: always verify diff output before pushing sed-generated content

### Skill Slimming Analysis (from Explore agent)
- Handoff skill was 2-2.5x larger than comparable skills (handoffplan: 243, beads: 298)
- Token cost: ~5,500-6,500 tokens per invocation at 601 lines
- After slimming: ~4,200-5,500 tokens at 477 lines (15-20% reduction)
- Main cuts: duplicate tables, compressed agent descriptions, removed Rules section
- Over-compression of Evidence guidance caused data loss — had to restore

## Session Closed
**Closed at:** 2026-03-25
**Commit:** 466d52d
**Session status:** Handed off to next session

## Quick Start for Next Session

```bash
# Reference docs
cat ~/.claude/skills/handoff/skill.md | head -50   # Check current triggers and guard
cat ~/.claude/skills/handoffplan/skill.md | head -30  # Check handoffplan Step 1

# Public repo state
cd /c/Standalone/claude-handoff && git log --oneline -5 && git tag -l | tail -3

# PR status
gh pr list --repo ComposioHQ/awesome-claude-skills --author REMvisual
gh pr list --repo jqueryscript/awesome-claude-code --author REMvisual
gh pr list --repo travisvn/awesome-claude-skills --author REMvisual
gh pr list --repo rohitg00/awesome-claude-code-toolkit --author REMvisual

# Memory files
cat ~/.claude/projects/C--Users-SIMANGO/memory/claude_handoff_prs.md
cat ~/.claude/projects/C--Users-SIMANGO/memory/handoff_v5_testing.md

# Next action: Check PR status, resubmit hesreallyhim after cooldown
```
