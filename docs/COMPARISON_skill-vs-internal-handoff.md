# Handoff Skill vs Internal Session Summary: Side-by-Side Comparison

**Date:** 2026-04-01
**Test conditions:** Same P0 bug (Electron OAuth session transfer), same codebase (VoidGram v3.1.0), two fresh Claude Code sessions launched simultaneously with different resume prompts.

## Setup

| Session | Resume prompt source | Onboarding protocol |
|---|---|---|
| **Internal** | Claude's auto-generated session status (context compression summary reused as handoff) | None — just a paste prompt with bug description and key files |
| **Skill-based** | `/handoff` skill output (structured handoff file with chain tracking, evidence, onboarding gate) | 4-step narration + wait for go-ahead |

## Behavioral Comparison

| Dimension | Internal (no skill) | Skill-based handoff |
|---|---|---|
| **First action** | Started reading code immediately | Read handoff file, checked beads |
| **User intervention needed?** | YES — user had to say "don't alter anything just yet" | No — waited for go-ahead as instructed |
| **Exploration rounds** | 5 rounds of searching/reading (chaotic, undirected) | 1 structured pass after onboarding |
| **Comprehension proof** | None — went straight to code analysis | Full narration: goal, current state, what was tried, root cause |
| **Bead tracking** | Read the bead but never claimed it | Explicitly claimed VoidGram-gyy |
| **Chain awareness** | Zero — no mention of seq, parent, or prior handoffs | Referenced "Option 3 (Best UX) from the handoff" — understood prior session's analysis |
| **Thinking time** | Scattered across multiple tool calls | "Cogitated for 51s" — deep upfront thinking |
| **Ready state** | "Ready to implement when you say go" (after being stopped) | "Waiting for your go-ahead before executing" (self-gated) |

## Fix Quality Comparison

### Internal session proposed: Set cookie on DB fallback

The `/api/auth/check` endpoint detects the user via DB fallback but doesn't set a session cookie. Fix: create a JWT and set the cookie when DB fallback detects the user.

**Assessment:** Band-aid. Still relies on cookies as the cross-process auth mechanism. Patches the symptom (Electron doesn't have the cookie -> give it one late) without addressing the fundamental problem that cookies can't reliably cross process boundaries.

### Skill-based session proposed: Server-side pending token store

Add `pendingSessionToken` + `pendingSessionCreatedAt` to the User model. Proxy-callback writes the JWT here. Electron's polling reads it, stores it client-side, clears the pending token. 5-minute TTL.

**Assessment:** Proper architecture. The server becomes the rendezvous point between browser and Electron. No cookie dependency for cross-process auth. Matches "Option 3 (Best UX)" from the prior session's handoff analysis — showing chain continuity.

### Notable discovery by internal session

The internal session found a **JWT secret mismatch** bug that the skill-based session missed:
- `config.ts ensureSecureSecrets()` generates JWT_SECRET_A but writes to wrong file path
- `setup.ts ensureSecuritySecrets()` generates JWT_SECRET_B, overwriting runtime config
- Old cookies (signed with _A) become invalid, making setup appear not to persist

This was found because the internal session read MORE code files more aggressively (including config.ts, which wasn't in the handoff's "key files" list). The skill-based session trusted the handoff's file list.

## Scorecard

| Category | Winner | Why |
|---|---|---|
| **Process discipline** | Skill | Waited, narrated, gated |
| **User control** | Skill | No intervention needed |
| **Architectural quality of fix** | Skill | Server-side token store > cookie band-aid |
| **Bug discovery breadth** | Internal | Found 6 bugs vs 4, including JWT secret mismatch |
| **Chain continuity** | Skill | Knew about prior session's analysis |
| **Risk of premature action** | Internal worse | Would have started coding without permission |
| **Context efficiency** | Skill | Less thrashing, more directed exploration |

## Key Insights

1. **The comprehension gate produces better fixes.** The skill session was forced to understand the problem before proposing a solution. The internal session read more code but understood less — proposing a cookie band-aid instead of a proper cross-process mechanism.

2. **Aggressive exploration has value.** The internal session found the JWT mismatch by reading config.ts — a file not in the handoff's key files list. The handoff's onboarding protocol should encourage exploring beyond listed files.

3. **"One-line fix" framing is dangerous.** The previous session's internal status said "It's a one-line fix." The internal session's proposed fix IS simpler — but simpler != correct. The skill session's deeper understanding led to a more robust fix.

4. **Skill shadowing is a real UX problem.** Claude generates handoff-like documents without the skill, borrowing its vocabulary but missing its process. Users can't distinguish the quality difference without comparing side-by-side.
