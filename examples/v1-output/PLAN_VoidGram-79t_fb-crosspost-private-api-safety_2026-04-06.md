# Private API Hybrid Relay + Safety Architecture + Remaining Parity

**Date:** 2026-04-06
**Status:** PLANNED
**Bead(s):** VoidGram-feh (P0), VoidGram-79t (epic), VoidGram-hxh, VoidGram-mhu, VoidGram-fl6, VoidGram-0mu
**Epic:** VoidGram v3.1 — Auth Refactor, App Review, Stickers, Mobile & Marketing
**Chain:** `VoidGram-79t` seq `5`
**Context:** See `HANDOFF_VoidGram-79t_fb-crosspost-private-api-safety_2026-04-06.md` for full session data, 8-agent research results, and prior approaches.

---

<!-- NOTE: Lines 10-195 were collapsed in transcript. The plan as presented in plan mode 
     (verbatim from the file) is captured below from the plan mode approval output. -->

## Plan as presented in plan mode:

Source: plans/handoffs/PLAN_VoidGram-79t_fb-crosspost-private-api-safety_2026-04-06.md
Handoff: plans/handoffs/HANDOFF_VoidGram-79t_fb-crosspost-private-api-safety_2026-04-06.md
Chain: VoidGram-79t seq 5

---
### Context

The Private API triggered an Instagram account lock when a cloud-scheduled story with mentions 
published from a Cloudflare Worker. Root cause: three-way Private API activity (Electron + dev 
server + Worker) from different IPs, zombie job processors from failed startups, and 4 fresh 
logins in 24 hours. The architecture needs a hybrid relay system where the Worker routes Private 
API calls through the user's local machine (residential IP) when possible, with a 48-hour phased 
burn-in for autonomous operation when the app is closed.

### Phase 1: P0 Fixes — Prevent Zombie Processors (VoidGram-9i2)

- Move initJobProcessor() inside app.listen() callback in apps/server/src/index.ts
- Add file-based mutex (data/server.lock) in new apps/server/src/lib/serverLock.ts
- Add dev-mode detection in apps/desktop/src/main.ts
- Validates: Start Electron, then npm run dev — should exit with error. Only 1 job processor running.

### Phase 2: Polling Relay — Private API Through Local Machine (VoidGram-y3v)

- Worker writes relay commands to KV (relay-cmd:{userId}:{jobId})
- New Worker endpoints: GET /relay/pending, POST /relay/result
- Electron background poller (60s interval) in apps/server/src/services/relayPoller.ts
- 15-min fallback: if no pickup, Worker executes directly (Phase 3 sessions only)
- Files: cloudflare-worker/src/handlers/relay.ts (new), apps/server/src/services/relayPoller.ts (new), publisher.ts, storyReposter.ts

### Phase 3: Session Safety — Lease + Heartbeat + Burn-In (VoidGram-bhq)

- Session lease in KV (20-min TTL, single-writer principle)
- Desktop heartbeat (10-min TTL, 5-min renewal)
- Session warming cron: Phase 1 (24h warmup) → Phase 2 (24h DM reads) → Phase 3 (full access)
- Grandfathering existing reposter sessions to Phase 3
- Files: cloudflare-worker/src/cron/sessionWarmer.ts (new), apps/server/src/services/heartbeat.ts (new)

### Phase 4: Fingerprint Hardening (VoidGram-063)

- Fix 6 Worker IG client mismatches: upload params, configureStory fields, usernameinfo endpoint, human delays, connectionType serialization, bandwidth headers
- Files: cloudflare-worker/src/services/igPrivateApi.ts, apps/server/src/services/igClient/session.ts, apps/server/src/services/igClient/types.ts

### Phase 5: Testing & Verification (VoidGram-h41)

- Account recovery, relay test, carousel cloud test, text overlay visual verify, 48h soak test
- Zero code changes — verification only

### Phase 6: Features & Polish (VoidGram-796)

- FB story cross-posting, Private API UX, story toggle UI, remove button fix, X/Twitter, App Review, release

### Dependencies

- Phase 1 MUST complete before Phases 2-4
- Phases 2, 3, 4 can run in parallel (ship together)
- Phase 5 requires 1-4 complete
- Phase 6 is independent

### Verification

- Zero account locks during 48h soak test
- Story with mentions works via relay (app open) AND Worker direct (app closed, Phase 3)
- Only ONE job processor runs at a time
- All cloud publish types: Image, Reel, Story, Story+mentions, Carousel with FB cross-post

## Beads created:

- VoidGram-9i2 (P0) — Phase 1: Zombie processor fix
- VoidGram-y3v (P1) — Phase 2: Polling relay
- VoidGram-bhq (P1) — Phase 3: Session safety
- VoidGram-063 (P2) — Phase 4: Fingerprint hardening
- VoidGram-h41 (P2) — Phase 5: Testing
- VoidGram-796 (P2) — Phase 6: Features & polish

Dependencies: Phase 1 blocks 2/3/4. Phases 2/3/4 block Phase 5. Phase 6 is independent.

## FAILURE POINT:

After user approved plan, assistant said:
> "Plan approved. Let me close this session with a commit and handoff prompt."

Then committed and wrote paste prompt instead of executing Phase 1.
