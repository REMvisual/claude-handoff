# Handoff: API Rate Limiting

| Field | Value |
|-------|-------|
| **Date** | 2026-03-15 18:42 UTC |
| **Status** | IN PROGRESS |
| **Tasks** | PROJ-abc1, PROJ-abc2 |
| **Chain** | `rate-limit-chain-7f3a` seq 2 of N |
| **Parent** | `HANDOFF_api-rate-limiting_2026-03-14.md` (seq 1) |
| **Branch** | `feat/api-rate-limiting` |

---

## The Goal

Add request rate limiting to the Orders REST API. Each API key gets a per-minute
request budget. Requests exceeding the budget receive a `429 Too Many Requests`
response with a `Retry-After` header. Rate limit state must survive server restarts
(Redis-backed) and add no more than 20ms to p99 latency.

---

## Where We Are

Work completed this session (building on seq 1 which scaffolded the middleware):

- Implemented `SlidingWindowLimiter` class in `src/middleware/rate_limiter.py` — replaced the token bucket prototype from seq 1
- Redis key schema: `rl:{api_key}:{endpoint}:{window_minute}` with 120s TTL
- Added `RateLimitConfig` dataclass in `src/config/rate_limits.py` with per-endpoint overrides
- Default budget: 100 req/min globally, `/orders POST` at 30 req/min, `/orders GET` at 200 req/min
- Wrote 14 unit tests in `tests/unit/test_rate_limiter.py` — all passing
- Wrote 6 integration tests in `tests/integration/test_rate_limit_e2e.py` — 5 passing, 1 flaky (see Risks)
- Response headers implemented: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- `429` response body follows existing error schema: `{"error": {"code": "RATE_LIMITED", "message": "...", "retry_after": 34}}`
- Benchmarked middleware overhead: p50 = 2ms, p95 = 8ms, p99 = 18ms (under 20ms target)
- Added `rate_limit_hit` counter to Prometheus metrics in `src/observability/metrics.py`
- Updated OpenAPI spec (`openapi.yml`) with `429` response documentation on all endpoints
- Skipped dashboard UI work — descoped to Phase 3 per decision below

---

## What We Tried

### 1. Token Bucket (seq 1 — abandoned)

The first session implemented a token bucket algorithm with in-memory state. It worked
in single-process mode but broke immediately under gunicorn with multiple workers.
Each worker maintained its own bucket, so a client with a 100 req/min limit could
actually send 400 req/min across 4 workers.

**Why abandoned**: Shared state required. Could use shared memory but fragile on
restarts. Redis was already in the stack for caching, so centralized state was the
cleaner path.

### 2. Fixed Window Counter (this session — abandoned after 30 min)

Implemented a simple fixed-window counter in Redis (`INCR` + `EXPIRE`). Fast to build,
but failed the "boundary burst" test: a client sending 100 requests at minute 0:59 and
100 more at minute 1:01 effectively gets 200 req/min. Product team confirmed this
boundary behavior was unacceptable for the billing endpoint.

**Why abandoned**: Burst vulnerability at window boundaries. The sliding window approach
solves this with minimal additional complexity.

### 3. Sliding Window Log (current — kept)

Uses a sorted set in Redis (`ZADD` with timestamp scores, `ZRANGEBYSCORE` to count).
Slightly more Redis memory per key (~2KB per active client vs ~64B for fixed window)
but eliminates boundary bursts entirely. Memory cost is acceptable given our client
count (~800 active API keys).

---

## Key Decisions

- **Sliding window over fixed window** — 3x more Redis memory but eliminates the boundary burst problem that made fixed windows unacceptable for billing endpoints
- **Per-endpoint limits over global-only** — Product requirement: write endpoints need tighter limits than reads. Stored in `rate_limits.yaml` config file, not hardcoded
- **Redis over in-memory** — Multi-worker deployment makes in-memory state unreliable without complex IPC; Redis was already in the stack
- **Descoped dashboard to Phase 3** — Building the rate limit metrics dashboard would add 2-3 sessions of work; the API and headers are the MVP. Product agreed via Slack (2026-03-15, #api-team channel)

---

## Evidence & Data

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| p50 latency | 4ms | 6ms | < 25ms |
| p95 latency | 9ms | 14ms | < 30ms |
| p99 latency | 12ms | 18ms | < 20ms |
| 429 accuracy | N/A | 98.5% | > 95% |
| Redis memory per key | N/A | ~2.1 KB | < 5 KB |

- Load test: 1000 req/s sustained for 60s with 50 unique API keys, zero Redis timeouts
- The 1.5% inaccuracy in 429s comes from clock skew between app servers — within tolerance
- Redis `ZRANGEBYSCORE` p99 under load: 0.4ms

---

## Files Changed

**Core implementation:**
- `src/middleware/rate_limiter.py` — NEW — `SlidingWindowLimiter`, `RateLimitMiddleware`
- `src/config/rate_limits.py` — NEW — `RateLimitConfig` dataclass, YAML loader
- `src/config/rate_limits.yaml` — NEW — per-endpoint limit definitions

**Integration points:**
- `src/app.py` — MODIFIED — registered `RateLimitMiddleware` in ASGI stack
- `src/observability/metrics.py` — MODIFIED — added `rate_limit_hit` Prometheus counter
- `openapi.yml` — MODIFIED — added `429` responses and `X-RateLimit-*` header docs

**Tests:**
- `tests/unit/test_rate_limiter.py` — NEW — 14 tests
- `tests/integration/test_rate_limit_e2e.py` — NEW — 6 tests (1 flaky)
- `tests/conftest.py` — MODIFIED — added Redis mock fixture

---

## Where We're Going

1. **Fix the flaky integration test** — `test_concurrent_requests_across_workers` fails ~15% of the time due to timing sensitivity. Needs a deterministic clock or wider assertion tolerance.
2. **Add Redis connection failure fallback** — Currently if Redis is down, all requests get a 500. Should fail-open (allow requests) with a degraded-mode metric. See PROJ-abc3.
3. **Per-endpoint config hot-reload** — Currently requires restart to pick up `rate_limits.yaml` changes. Watch the file or add an admin endpoint.
4. **Phase 3: Dashboard** — Grafana panels showing rate limit hits by endpoint and API key. Prometheus metrics are already emitting; this is a dashboard-only task.

---

## Risks & Blockers

1. **Flaky test blocks merge** — CI will reject the PR until `test_concurrent_requests_across_workers` is stable. Estimate: 30 min to fix with a deterministic clock injection.
2. **Redis failover behavior unknown** — We tested against a single Redis instance. Sentinel/cluster failover during a rate limit check could cause brief inconsistency. Needs testing before production deploy.

---

## Open Questions

1. Should rate limit state survive a Redis flush? Currently it does not — a `FLUSHDB` resets all limits. Is that acceptable for ops, or do we need a separate Redis DB/instance?
2. The product team mentioned wanting per-plan rate limits (free tier = 50/min, pro = 500/min). This needs a lookup from API key → plan. Where does that mapping live — user service? Config file?

---

## Quick Start for Next Session

```bash
# Get oriented
cd C:/projects/orders-api
git checkout feat/api-rate-limiting
git log --oneline -5

# Run the tests (need Redis running)
docker compose up -d redis
pytest tests/unit/test_rate_limiter.py -v
pytest tests/integration/test_rate_limit_e2e.py -v

# See the flaky test fail
for i in {1..10}; do pytest tests/integration/test_rate_limit_e2e.py::test_concurrent_requests_across_workers; done

# Load test (optional — takes ~90s)
locust -f tests/load/locustfile.py --headless -u 50 -r 10 -t 60s
```

**Start with**: Fix the flaky test, then implement Redis failure fallback (fail-open).
