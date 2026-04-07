# Facebook Cross-Posting Fixed + Private API Safety Architecture + Cloud Publishing Parity

**Date:** 2026-04-06
**Status:** IN PROGRESS — FB cross-posting working, Private API relay architecture designed but not implemented
**Bead(s):** VoidGram-79t (epic, open), VoidGram-feh (P0 bug, open), VoidGram-hxh (P2, open), VoidGram-mhu (P2, open), VoidGram-0mu (P2, open), VoidGram-fl6 (P3, open)
**Epic:** VoidGram v3.1 — Auth Refactor, App Review, Stickers, Mobile & Marketing
**Chain:** `VoidGram-79t` seq `5`
**Parent:** `HANDOFF_VoidGram-79t_cloud-scheduling-fixed-fb-crosspost_2026-04-03.md` (seq 4)
**Prior chain:** `HANDOFF_VoidGram-79t_meta-app-review-auth-refactor_2026-03-31.md` > seq 2 (deleted) > seq 3 > seq 4 > this

---

<!-- NOTE: This is a PARTIAL capture from session transcript. Lines 10-230 were collapsed 
     in the transcript ("ctrl+o to expand"). Only the header, the two expansion edits 
     (lines 234-301 and 418-460), and structure are preserved here for v1 vs v2 comparison.
     Total file was 508 lines (397 initial + 68 expansion + 43 expansion). -->

<!-- === EXPANSION 1: Research Agent Dispatch Log (inserted at line 234) === -->

### Research Agent Dispatch Log (8 agents this session)

| Agent | Task | Key Finding |
|-------|------|-------------|
| Code Reviewer | Audit FB cross-post local path | 1 BLOCKER (IG refresh wipes FB link), 5 WARNINGS |
| Technical Writer | App Review justification text | Ready-to-paste text for both IG permissions |
| Explore | Worker cloud cross-post gap | Confirmed FB cross-post is local-only (TODO in publisher) |
| Explore | Valid FB page scopes | `pages_manage_posts` is real but needs dashboard activation |
| Security Engineer #1 | Deep Private API safety | IP jump + 6 fingerprint mismatches + reposter vs publisher differences |
| Security Engineer #2 | Dual server conflict check | Confirmed 3-way Private API activity + zombie processors |
| Security Engineer #3 | Residential proxy for Workers | Workers CAN'T use proxies (hard constraint). Use ngrok relay. |
| Security Engineer #4 | Instagram detection research | IP reputation scoring, TLS fingerprinting, session-IP binding details |
| Software Architect #1 | Session migration design | Phased burn-in (48h), session lease, heartbeat, warming cron |
| Software Architect #2 | App Review + API strategy | Graph API has ZERO story sticker support. Private API is only path. |
| Backend Architect #1 | Worker-to-local proxy design | Full PrivateApiExecutor abstraction + relay endpoint contract |
| Backend Architect #2 | Media processor Fill mode fix | Direct resize for sub-canvas images |

### App Review Dashboard State

| Field | Current Value | Action Needed |
|-------|--------------|---------------|
| App icon | Not set | Upload `apps/desktop/resources/icon.png` (512x512) |
| Privacy policy URL | `https://voidgram.org/privacy` | Add trailing slash |
| App category | Utility & productivity | OK |
| Site URL | `voidgram.com` | Change to `https://voidgram.org` |
| Platform | Website added | Set URL to `https://voidgram.org` |
| Business verification | In review (~2 business days) | Wait |
| `pages_manage_posts` | Ready for testing, 0 calls | Need screencast + description |
| `instagram_business_basic` | Ready for testing, 26 calls | Need screencast + description |
| `instagram_business_content_publish` | Ready for testing, API calls done | Need screencast + description |
| Data handling | Not filled in | No processor, Alon Hammer, US, No sharing |
| Reviewer instructions | Not filled in | Desktop app + test instructions |

### Graph API vs Private API Feature Matrix

| Feature | Graph API | Private API | Can Move to Graph? |
|---------|:---------:|:-----------:|:------------------:|
| Image/Reel/Carousel publishing | YES | n/a | Already there |
| Story publishing (plain) | YES | n/a | Already there |
| Story mention stickers | NO | YES | **NO — parameters don't exist** |
| Story repost detection (DM scan) | Partial (webhooks) | YES | Future with `manage_messages` |
| Story repost execution | NO | YES | **NO** |
| User PK resolution | NO | YES | **NO** |
| FB cross-posting | YES | n/a | Already there |
| Collaborators/tags/location | YES | n/a | Already there |

### Worker IP Trust Classification (from research)

| IP Type | Trust Score | Example |
|---------|-------------|---------|
| Mobile carrier | 85-99 | T-Mobile, Verizon Wireless |
| Residential ISP (clean) | 70-85 | Comcast, AT&T |
| Residential ISP (Spur flagged) | 30-50 | Bright Data exit nodes |
| Business/static IP | 40-60 | Commercial fiber |
| Cloud/VPS | 10-30 | AWS, GCP, DigitalOcean |
| **Cloudflare Workers** | **5-15** | **AS13335 — lowest tier** |

### Commercial IG Automation Architecture Comparison

| Tool | Infrastructure | IP Quality | Approach |
|------|---------------|------------|----------|
| Jarvee | User's Windows PC | Residential | Self-hosted, proxy per account |
| Inflact | Cloud + Bright Data proxies | Residential | Managed, $50-100/mo |
| Kicksta | Cloud + residential proxies | Residential | Managed, similar to Inflact |
| instagrapi (lib) | User's server | User-provided | Recommends same IP as login |
| **VoidGram (current)** | **CF Worker direct** | **Datacenter** | **Fails — account locked** |
| **VoidGram (proposed)** | **Relay through user's machine** | **Residential** | **Safe — same as Jarvee model** |

<!-- === EXPANSION 2: Relay Architecture Design (inserted at line 418) === -->

## Relay Architecture Design (from research agents)

### Option A: ngrok relay (Worker calls local server directly)
```
Worker cron → fetch(ngrokUrl/api/private-api/proxy) → local server → fetch(i.instagram.com) → residential IP → Instagram
```
- Pros: low latency (~200ms overhead), existing infra, simple
- Cons: depends on ngrok being up, ngrok rate limits on free tier

### Option B: Polling relay (Electron polls Worker for commands) — RECOMMENDED
```
Worker cron → write relay-cmd:{userId}:{jobId} to KV → Electron polls every 60s → executes locally → reports result
```
- Pros: no ngrok dependency for relay, simpler Worker code, graceful offline handling
- Cons: 60s polling latency (acceptable for scheduled posts)

### Fallback Strategy (app offline)
| Scenario | Action |
|----------|--------|
| Desktop online (heartbeat present) | Route through local (residential IP) |
| Desktop offline, session Phase 3 | Worker executes directly (safe, burned in) |
| Desktop offline, session Phase 1-2 | Queue in KV, retry each cron tick until desktop comes online or Phase 3 reached |
| Desktop offline 4+ hours, story about to expire | Worker executes with extra safety delays |

### User-Facing Messaging (Simple)
**In Settings → Private API section:**
- "Your account is warming up. Story mentions and reposting work when VoidGram is open. In about [X] hours, these features will also work with VoidGram closed."
- After 48h: "Fully autonomous. Story mentions and reposting work even when VoidGram is closed."

### New KV Keys
- `relay-cmd:{userId}:{jobId}` — pending command for local execution
- `session-lease:{accountId}` — who owns the session (local/worker), TTL 20min
- `session-phase:{accountId}` — warming phase (1/2/3), call counts, timestamps
- `desktop-heartbeat:{userId}` — local server is online, TTL 10min
- `meta:local-proxy-url` — ngrok URL for Option A relay

### New Files to Create
- `apps/server/src/routes/privateApiProxy.ts` — proxy endpoint (Option A)
- `apps/server/src/services/heartbeat.ts` — heartbeat + lease management
- `cloudflare-worker/src/services/localProxy.ts` — online detection + proxy client
- `cloudflare-worker/src/services/privateApiExecutor.ts` — unified local/direct execution
- `cloudflare-worker/src/cron/sessionWarmer.ts` — phase-based warming logic
