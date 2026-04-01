# Handoff Skill vs Internal Session Summary: Three-Way Comparison

**Date:** 2026-04-01
**Test conditions:** Same P0 bug (Electron OAuth session transfer), same codebase (ExampleApp v3.1.0), fresh Claude Code sessions with different resume prompts. The third session used v1.5.0 of the skill (with expanded onboarding protocol).

## Setup

| Session | Resume prompt source | Onboarding protocol | Skill version |
|---|---|---|---|
| **Internal** | Claude's auto-generated session status (context compression summary reused as handoff) | None — just a paste prompt with bug description and key files | N/A |
| **Skill v1.4** | `/handoff` skill output (structured handoff file with chain tracking, evidence, onboarding gate) | 4-step narration + wait for go-ahead | v1.4.x |
| **Skill v1.5** | Same `/handoff` output, re-generated after v1.5.0 update | 5-step narration (added adjacent file exploration) + wait for go-ahead | v1.5.0 |

## Three-Way Behavioral Comparison

| Dimension | Internal (no skill) | Skill v1.4 | Skill v1.5 |
|---|---|---|---|
| **First action** | Started reading code immediately | Read handoff file, checked beads | Read handoff file, checked beads |
| **User intervention needed?** | YES — "don't alter anything yet" | No — self-gated | No — self-gated |
| **Exploration rounds** | 5 rounds (chaotic) | 1 structured pass | 1 structured pass + adjacent exploration |
| **Comprehension proof** | None — straight to code | Full narration | Full narration + deeper root cause |
| **Adjacent file exploration** | Aggressive but undirected | Trusted handoff's file list only | Structured: listed 5 specific adjacent files and what each confirmed |
| **Bead tracking** | Read bead, never claimed | Explicitly claimed | Explicitly claimed |
| **Chain awareness** | Zero | Referenced prior session's analysis | Referenced prior session's analysis |
| **Thinking time** | Scattered across tool calls | 51s cogitation | 2m 24s cogitation |
| **New bugs found beyond handoff** | JWT secret mismatch (config.ts) | None | open-external allowlist gap |

## Fix Quality Comparison

### Internal: Set cookie on DB fallback (surface-level reasoning)

The `/api/auth/check` endpoint detects the user via DB fallback but doesn't set a session cookie. Fix: create a JWT and set the cookie when DB fallback detects the user.

**Assessment:** Correct fix idea, wrong reasoning. Proposed as a band-aid without understanding the full call chain. Couldn't explain *why* it would work beyond "Electron doesn't have the cookie."

### Skill v1.4: Server-side pending token store (architectural)

Add `pendingSessionToken` + `pendingSessionCreatedAt` to the User model. Proxy-callback writes the JWT here. Electron's polling reads it, stores it client-side, clears the pending token. 5-minute TTL.

**Assessment:** Architecturally sound but potentially over-engineered. Eliminates cookie dependency entirely — a new DB column and cleanup logic for a problem that may be solvable with a simpler approach.

### Skill v1.5: Set cookie on DB fallback (precise call-chain reasoning)

Traced the complete failure path: `/api/auth/check` returns `authenticated: true` → wizard advances → `useAuth()` calls `/api/auth/me` → `requireAuth` middleware checks for cookie → no cookie → 401 → redirect to login. Fix: when `/check` detects a user via DB fallback, also mint a JWT and set the session cookie (~5 lines).

**Assessment:** Same fix as the internal session, but arrived at through precise call-chain tracing. Can explain exactly WHY it works: the wizard already advances on `authenticated: true`, but subsequent `requireAuth` calls need the cookie. Setting it during the check-that-succeeds bridges the gap. The adjacent file exploration (finding `useAuth.ts` → `/auth/me` → `requireAuth`) made this reasoning possible.

### Notable discovery by internal session

The internal session found a **JWT secret mismatch** bug that neither skill session caught:
- `config.ts ensureSecureSecrets()` generates JWT_SECRET_A but writes to wrong file path
- `setup.ts ensureSecuritySecrets()` generates JWT_SECRET_B, overwriting runtime config
- Old cookies (signed with _A) become invalid, making setup appear not to persist

Found because the internal session read config.ts aggressively — a file not in the handoff's key files list.

### Notable discovery by v1.5 session

The v1.5 session found an **open-external allowlist gap** that neither previous session caught:
- `main.ts` lines 499-516 list allowed hostnames for `shell.openExternal()`
- `auth.example.org` (the OAuth proxy) is missing from the list
- Not a blocker currently (login URL starts as localhost, which is allowed) but a robustness issue

Found because the v1.5 onboarding protocol explicitly asks for adjacent file exploration.

## Scorecard

| Category | Internal | Skill v1.4 | Skill v1.5 |
|---|---|---|---|
| **Process discipline** | Poor (had to be stopped) | Good | Good |
| **Root cause precision** | Surface | Architectural | Precise call chain |
| **Fix correctness** | Correct but unjustified | Correct but heavy | Correct and justified |
| **Bug discovery breadth** | 6 bugs (JWT mismatch) | 4 bugs | 5 bugs (allowlist gap) |
| **Adjacent file exploration** | Chaotic, found real bugs | None beyond handoff | Structured, found real gaps |
| **User control** | Required intervention | Self-gated | Self-gated |
| **Chain continuity** | None | Full | Full |

## Key Insights

1. **The comprehension gate produces better fixes.** Both skill sessions were forced to understand the problem before proposing solutions. The internal session read more code but understood less in the first pass.

2. **Adjacent file exploration (v1.5) closes the gap.** The v1.4 skill session's main weakness was trusting the handoff's file list exclusively. The v1.5 protocol explicitly encourages exploring beyond listed files — and it worked: the session found `useAuth.ts` → `/auth/me` → `requireAuth`, which is the actual failure path, plus the allowlist gap.

3. **Same fix, different confidence.** The internal and v1.5 sessions proposed the same fix (set cookie on DB fallback). But v1.5 can explain the complete call chain that makes it correct. During implementation, this means v1.5 will handle edge cases better and write more targeted tests.

4. **"One-line fix" framing is dangerous.** The previous session's internal status said "It's a one-line fix." This anchored the internal session toward the simplest possible change without full reasoning. The v1.5 session's 2m 24s of cogitation produced the same fix with better justification.

5. **Skill shadowing is a real UX problem.** Claude generates handoff-like documents without the skill, borrowing its vocabulary but missing its process. Users can't distinguish the quality difference without comparing side-by-side. v1.5.0 adds an anti-shadowing guard to prevent this.

6. **Over-engineering risk in v1.4.** The v1.4 session's pendingSessionToken approach, while architecturally clean, adds a DB column and cleanup logic for a problem solvable with 5 lines. The v1.5 session's deeper understanding led to a more proportionate fix. Understanding the problem well enough to choose the *simplest correct* solution is harder than proposing an architectural one.
