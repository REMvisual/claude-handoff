# v1.5.0 Release — Anti-Shadowing Guard, Three-Way A/B Comparison, Security Audit, PR Updates

**Date:** 2026-04-01
**Status:** COMPLETED
**Bead(s):** none (beads initialized but empty in this repo)
**Epic:** claude-handoff public release maintenance
**Chain:** `standalone-8c38e757` seq `1`
**Parent:** `none — first in chain`
**Prior chain:** none — first in chain

---

## The Goal

Maintain and improve the publicly released claude-handoff skill (https://github.com/REMvisual/claude-handoff). This session focused on a specific discovery: Claude generates freeform "handoff-like" documents without invoking the `/handoff` skill, producing inferior output that borrows the skill's vocabulary but lacks its process. The goal was to identify this problem, validate it with controlled testing, fix it, audit the repo for private data leaks, update community PRs, and release v1.5.0.

---

## Where We Are

- v1.5.0 released and tagged at commit `a8dc261` on master, pushed to GitHub
- GitHub release created: https://github.com/REMvisual/claude-handoff/releases/tag/v1.5.0
- Anti-shadowing guard added to `skills/handoff/skill.md` — explicit instruction that Claude must never generate freeform handoff-like documents without invoking `/handoff`
- Onboarding protocol expanded from 4 steps to 5 — new step 4: "explore 2-3 adjacent files not listed in the handoff"
- Quick Start template annotated: key files marked "not exhaustive — explore adjacent code too"
- "BPM engine unification" epic example replaced with generic "authentication-overhaul" in skill template
- Three-way comparison document written at `docs/COMPARISON_skill-vs-internal-handoff.md` — all private data genericized (ExampleApp, PROJ-abc1, auth.example.org)
- README updated with "Why this exists" section containing the three-way comparison table
- README updated with "Recommended: Prevent skill shadowing" section with CLAUDE.md snippet
- Broken star link fixed (pointed to `claude-workspace-snapshot` instead of `claude-handoff`)
- Private data handoff file removed: `plans/handoffs/HANDOFF_claude-handoff-v1.0-to-v1.4_2026-03-25.md` (contained Audiophile x16, SIMANGO x8, happy-otter, private filesystem paths)
- v1.4.1 release notes scrubbed on GitHub (removed Audiophile-n6ji reference)
- Local skill synced: `~/.claude/skills/handoff/skill.md` matches repo
- 3 open community PRs updated with v1.5.0 descriptions and bumped with comments
- Final grep scan: zero private data hits across all tracked files
- `.beads/.beads-credential-key` still in git history (noted, not yet purged — requires filter-repo)

---

## What We Tried (Chronological)

### 1. Compared internal session status vs custom handoff (analysis only)

User pasted both a Claude auto-generated "session status" and the skill-generated handoff paste prompt for the same P0 bug (Electron OAuth in a desktop app). Analyzed the structural differences: the internal status had better "what works" inventory and a specific fix hint, while the custom handoff had comprehension gates, bead linkage, and chain tracking. Created a comparison table.

**Result:** Identified that the internal status was never meant to be a handoff — it's a context compression self-note that got repurposed. Led to the skill shadowing discovery.

### 2. Ran parallel A/B test — internal vs skill v1.4

User launched two fresh sessions simultaneously with the same P0 bug. Internal session dove into code immediately, had to be stopped ("don't alter anything yet"), proposed a cookie band-aid fix. Skill session followed the onboarding protocol, self-gated, proposed a server-side token store fix.

**Result:** Skill session produced architecturally superior fix. Internal session found more bugs through aggressive exploration (including a JWT secret mismatch that the skill session missed).

### 3. Identified the "adjacent file exploration" gap

The skill v1.4 session missed the JWT mismatch because it trusted the handoff's "key files" list exclusively. The internal session found it by chaotically reading config.ts — a file not in the handoff.

**Result:** Added step 4 to onboarding protocol: "explore 2-3 adjacent files not listed in the handoff."

### 4. Released v1.5.0 with anti-shadowing guard

Added the ANTI-SHADOWING paragraph to skill.md, updated onboarding protocol, wrote comparison doc, updated README. Tagged and pushed.

**Result:** Push initially rejected (remote had new commits). Pulled with rebase, re-tagged, pushed successfully.

### 5. User tested v1.5.0 handoff on the same project

Re-ran `/handoff` on the desktop app project using the updated skill. Produced a 408-line handoff at Tier 3. Chain tracking worked (seq 2, parent found). Then launched a fresh session with the v1.5.0 paste prompt.

**Result:** v1.5 session traced the complete failure call chain (`/check` → `authenticated:true` → wizard advances → `/me` → `requireAuth` → no cookie → 401), proposed the same fix as the internal session but with precise justification. Also found an open-external allowlist gap. Cogitated for 2m 24s. No user intervention needed.

### 6. Security audit — parallel agents

Launched two agents simultaneously: Security Engineer audited the repo (52 tool uses, 173s), general-purpose agent audited all GitHub releases (5 tool uses, 37s).

**Repo audit found 18 findings:** 1 CRITICAL (`.beads-credential-key` binary in git history), 6 HIGH (VoidGram x2 in new comparison doc, Audiophile x16 in handoff file, SIMANGO x8 in paths, Happy/happy-otter refs, BPM epic in skill), 4 MEDIUM (Audiophile in old commits, Voidgram different casing, local filesystem paths, personal email in git metadata), 2 LOW (Steve Yegge name in handoff, beads project UUID).

**Release audit found 1 leak:** v1.4.1 release notes explicitly named "Audiophile-n6ji" — ironic since that release was specifically created to remove Audiophile references from code.

**Fixes applied:**
- `docs/COMPARISON_skill-vs-internal-handoff.md`: VoidGram → ExampleApp, VoidGram-gyy → PROJ-abc1, auth.voidgram.org → auth.example.org
- `skills/handoff/skill.md`: "BPM engine unification" → "authentication-overhaul"
- `README.md`: star link claude-workspace-snapshot → claude-handoff
- `plans/handoffs/HANDOFF_claude-handoff-v1.0-to-v1.4_2026-03-25.md`: deleted entirely
- v1.4.1 release notes: edited via `gh release edit` to remove Audiophile references

### 7. Updated community PRs

Found 11 total PRs by REMvisual across awesome-lists — 6 for claude-handoff, 5 for claude-workspace-snapshot (separate project). Updated 3 open claude-handoff PRs with v1.5.0 descriptions including A/B comparison table and features list. Bumped each with identical comment noting anti-shadowing guard and expanded onboarding. hesreallyhim requires manual browser submission (their bot auto-closed the PR with a 7-day cooldown).

---

## Key Decisions

- **Anti-shadowing goes IN the skill, not just CLAUDE.md** — The skill itself includes the guard because it's the authoritative document. But we also recommend a CLAUDE.md snippet in the README because the skill only helps when invoked — the CLAUDE.md catches the case where Claude decides to "help" without invoking any skill.
- **Step 4 (adjacent exploration) added to onboarding, not to the handoff itself** — The handoff captures what the previous session focused on. Telling the new session to look beyond is better than trying to make the handoff exhaustive. The handoff's key files are a starting point, not a complete list.
- **Removed the v1.0-v1.4 handoff file entirely rather than genericizing** — It had 16 Audiophile refs, 8 SIMANGO refs, private filesystem paths, happy-otter username, and Steve Yegge name-drops. Genericizing would require rewriting 50%+ of the content. It was internal development history with no value to public consumers.
- **Did NOT purge `.beads-credential-key` from git history** — Requires `git filter-repo` which rewrites all commits and invalidates existing clones. Deferred as P2. The key is a local beads credential, not an API key or secret with external access.
- **claude-workspace-snapshot is a SEPARATE project** — User corrected the assumption that it was an old repo name. Two different tools, two different sets of PRs. No cross-contamination needed.
- **Did NOT update merged PR descriptions** — The entries in rohitg00 and beads repos are accurate one-liners. Submitting PRs to update them with "now v1.5.0!" would be noise on community repos.
- **v1.5.0 tag was re-created after security fixes** — Original tag pointed to `6b9fe8c` (pre-security-fix). Deleted remote tag, re-tagged on `a8dc261` (post-fix), force-pushed. The GitHub release now points to the clean commit.
- **Over-engineering insight from v1.4 comparison** — The v1.4 skill session's `pendingSessionToken` DB column approach was architecturally clean but added unnecessary complexity. The v1.5 session's 5-line cookie fix achieved the same result. Understanding a problem deeply enough to choose the SIMPLEST correct solution is harder than proposing an architectural one. This insight informed the "Why this exists" framing in the README.

---

## Evidence & Data

### Three-Way Comparison Results

| Dimension | Internal (no skill) | Skill v1.4 | Skill v1.5 |
|---|---|---|---|
| User intervention needed | YES | No | No |
| Root cause precision | Surface-level | Architectural | Precise call chain |
| Fix correctness | Correct but unjustified | Correct but heavy | Correct and justified |
| Adjacent file exploration | Chaotic, found real bugs | None beyond handoff | Structured, found real gaps |
| Thinking time | Scattered | 51s cogitation | 2m 24s cogitation |
| Bugs found beyond handoff | JWT mismatch (config.ts) | None | open-external allowlist gap |
| Chain awareness | Zero | Full | Full |

### Security Audit Findings

| Priority | Finding | Status |
|---|---|---|
| P0 | `.beads-credential-key` in git history | Noted, deferred (requires filter-repo) |
| P0 | VoidGram in comparison doc | FIXED — genericized to ExampleApp |
| P0 | BPM engine unification in skill | FIXED — replaced with generic |
| P1 | Audiophile x16 + SIMANGO x8 in handoff file | FIXED — file removed |
| P1 | v1.4.1 release notes named Audiophile-n6ji | FIXED — release notes scrubbed |
| P1 | Broken star link to wrong repo | FIXED |
| P2 | Audiophile in git history (old commits) | Accepted — low visibility |
| P2 | Personal email in git metadata | Accepted — common for open source |

### Community PR Status

| PR | Repo | State | Action |
|---|---|---|---|
| ComposioHQ #446 | awesome-claude-skills | Open | Updated + bumped |
| travisvn #343 | awesome-claude-skills | Open | Updated + bumped |
| jqueryscript #109 | awesome-claude-code | Open | Updated + bumped |
| rohitg00 #78 | awesome-claude-code-toolkit | Merged | No action needed |
| beads #2731 | gastownhall/beads | Merged (by steveyegge) | No action needed |
| hesreallyhim #1028 | awesome-claude-code | Closed | Needs manual resubmission via browser |

### Commits This Session

| Hash | Message |
|---|---|
| `6b9fe8c` | feat: anti-shadowing guard, expanded onboarding protocol (v1.5.0) |
| `2684916` | fix: remove private project data from public repo |
| `a8dc261` | docs: three-way comparison data, scrub remaining private refs |

---

## Files Changed

### Source (skill)
- `skills/handoff/skill.md` — Added ANTI-SHADOWING paragraph, expanded onboarding from 4→5 steps, annotated Quick Start key files, replaced BPM epic example

### Documentation
- `README.md` — Added "Why this exists" section with three-way comparison table, "Recommended: Prevent skill shadowing" section with CLAUDE.md snippet, fixed broken star link
- `CHANGELOG.md` — Added v1.5.0 entry
- `docs/COMPARISON_skill-vs-internal-handoff.md` — NEW — Full three-way comparison data (all private data genericized)

### Removed
- `plans/handoffs/HANDOFF_claude-handoff-v1.0-to-v1.4_2026-03-25.md` — Contained private project data (Audiophile, SIMANGO, happy-otter)

---

## User Feedback & Preferences (REQUIRED — never omit)

- "these are two separate systems, one is claude handoff and one is claude workspace, they're different repos" — Corrected assumption about repo naming. Don't conflate the two.
- "why is that in our release.. that's terrible...." — Strong reaction to private data in public repo. Security scrubbing is non-negotiable.
- "obviously fix that" — Expects immediate action on security issues, don't ask permission.
- "well I guess we should test it first" — Wanted to validate v1.5.0 before cleaning up. Testing before shipping is preferred flow.
- "save what you need please" — Expects handoff data to be preserved before destructive operations.
- "don't alter anything just yet please" (in the VoidGram session) — Wants analysis before execution. The comprehension gate is valued.
- "im going to keep these sessions open" — Runs multiple parallel Claude sessions. Multi-session awareness matters.
- "lets focus on the PRs" — Direct, wants to move to the next task without dwelling.
- "you don't know? look and search" — Expects proactive investigation, not questions back.
- "go through it all please thanks" — Thorough PR audit, not surface-level check.
- "do we need to submit our new version?" — Thinks about whether merged entries need updating (answer: no, too noisy for one-liners).

---

## Where We're Going

1. **Resubmit to hesreallyhim/awesome-claude-code** — Must be done manually via browser using their issue template. Cooldown from March 20 has expired. Use A/B comparison data as evidence (they require it).
2. **Purge `.beads-credential-key` from git history** — Requires `git filter-repo`. Low urgency (local credential, not externally accessible) but should be cleaned up.
3. **Monitor open PRs** — ComposioHQ #446, travisvn #343, jqueryscript #109. Check back in ~1 week for reviewer activity.
4. **Test anti-shadowing guard in a natural session end** — The v1.5.0 guard was tested with explicit `/handoff` invocation. The real test is whether Claude stops improvising freeform handoffs when sessions end naturally (context compression, "we're done").

---

## Risks & Blockers

- **Git history still contains private data** — Audiophile bead IDs in old commits, `.beads-credential-key` binary. Low risk (requires cloning and digging through history) but not zero.
- **hesreallyhim has strict anti-automation rules** — The 7-day cooldown has expired but the repo owner is vigilant about CLI submissions. Manual browser submission required.

---

## Open Questions

1. Should the anti-shadowing guard be tested with a hook (detect when Claude is about to write a handoff-like document and redirect to the skill) rather than relying on in-skill instructions?
2. The v1.5 session's fix (set cookie on DB fallback) vs v1.4's fix (pendingSessionToken) — which is actually better for the VoidGram project? The comparison showed v1.5 understood better, but v1.4's approach may be more robust long-term.

---

## Code Analysis

- **Anti-shadowing guard text** (added to skill.md after the TRIGGER GUARD paragraph): "ANTI-SHADOWING: NEVER generate handoff-like documents without this skill. When ending a session, providing context for a future session, or responding to 'wrap up' / 'we're done' / 'save progress' — you MUST invoke /handoff..."
- **Recommended CLAUDE.md snippet** (added to README "Prevent skill shadowing" section):
  ```
  When ending a session, saving progress, or providing context for a future session:
  - ALWAYS use the /handoff skill. NEVER generate handoff summaries, session status
    documents, or "paste prompts for next session" without the skill.
  - The precompact hook handles automatic context compression — don't duplicate it manually.
  ```
- **Three-tier architecture for session endings** — discovered and documented:
  - Explicit handoff request → `/handoff` skill (always, no exceptions)
  - Auto context compression → `precompact-handoff.sh` (shell script, mechanical, ~50-80 lines)
  - Freeform improvisation → NEVER (this is the gap v1.5.0 closes)
- **Installed vs repo skill diff** — The installed skill at `~/.claude/skills/handoff/skill.md` had been customized: `myproject-xxxx` → `Audiophile-*` bead IDs, and Happy co-author credits added to commit template. The repo version has generic placeholders. After v1.5.0 changes, both were re-synced.
- **Precompact hook** — `hooks/precompact-handoff.sh` and `~/.claude/scripts/precompact-handoff.sh` are IDENTICAL. The hook captures git state (15 commits, 25 beads, 20 status lines) into a ~80 line auto-handoff file. It does NOT mine conversation — it's purely mechanical state capture. This is the correct behavior for auto-compression.
- **AGENTS.md line 143** — "Hand off — Provide context for next session" — this generic instruction is what causes Claude to improvise freeform handoffs. It tells Claude WHAT to do but not HOW. Fix is the CLAUDE.md snippet above, which explicitly says "use the /handoff skill."
- **PR update template** — All 3 open PRs were updated with identical body text including: repo link, "Why it exists" section with the A/B comparison table (4 rows), "Features (v1.5.0)" bullet list (7 items), and install instructions. Each was bumped with a comment noting v1.5.0 features.
- **hesreallyhim submission requirements** — Their issue template requires: Display Name, Category dropdown (use "Agent Skills"), repo URL, clear install AND uninstall instructions, evidence for capability claims, and answers to "Could Opus build this in one session?" They explicitly ban CLI submissions and have a 7-day cooldown for violations.

## Session Closed
**Closed at:** 2026-04-01
**Commit:** `58d99e5`
**Session status:** Handed off to next session

## Quick Start for Next Session

```bash
# Restore context
cd C:/Standalone/claude-handoff
git log --oneline -5

# Key files to read first (not exhaustive — explore adjacent code too)
skills/handoff/skill.md          # The core skill — check anti-shadowing guard
README.md                         # Public-facing docs with comparison table
docs/COMPARISON_skill-vs-internal-handoff.md  # A/B test data
CHANGELOG.md                      # Version history

# Verify current state
git status
gh release view v1.5.0 --repo REMvisual/claude-handoff

# Check PR status
gh search prs --author=REMvisual --limit 10

# Next action
# Submit to hesreallyhim/awesome-claude-code via browser issue template
```
