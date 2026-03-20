# Plan: API Rate Limiting

| Field | Value |
|-------|-------|
| **Date** | 2026-03-15 18:42 UTC |
| **Handoff** | `HANDOFF_api-rate-limiting_2026-03-15.md` |
| **Chain** | `rate-limit-chain-7f3a` seq 2 of N |
| **Tasks** | PROJ-abc1, PROJ-abc2, PROJ-abc3 |

---

## Problem Statement

The Orders API has no request rate limiting. Any API key can send unlimited requests,
which creates two problems: (1) a single misbehaving client can degrade performance
for everyone, and (2) we cannot enforce usage tiers for the upcoming paid plans.
Rate limiting must be transparent (clear headers), survivable (Redis-backed), and
cheap (under 20ms added latency at p99).

---

## Key Findings

These findings come from two sessions of implementation and testing (see handoff for full evidence):

- **Token bucket fails in multi-worker deployments** — in-memory state is per-process, allowing Nx the intended rate across N workers. Centralized state (Redis) is required. --> drives Phase 1 architecture
- **Fixed window counters have a boundary burst vulnerability** — 2x burst possible at window edges, unacceptable for billing endpoints per product team. --> drives Phase 1 algorithm choice (sliding window)
- **Sliding window Redis cost is ~2KB per active key** — with ~800 active API keys, total memory is ~1.6MB. Well within budget even at 10x growth. --> confirms Phase 1 approach is viable at scale
- **Middleware adds 18ms at p99 under load** — within the 20ms budget but leaves no margin. Redis connection pooling and pipeline batching could reduce this. --> drives Phase 2 optimization if needed
- **Per-plan rate limits need a key-to-plan mapping** — this does not exist today. User service owns plan data but has no lightweight lookup endpoint. --> drives Phase 2 dependency on user service team

---

## Anti-Goals

These were explicitly considered and rejected. Do not revisit without new information:

1. **In-memory rate limiting** — Tried in seq 1. Fundamentally broken in multi-worker ASGI deployments. Do not attempt shared-memory IPC workarounds; Redis is already in the stack and proven.
2. **Fixed window counters** — Tried in seq 2. The boundary burst problem (2x allowed rate at window edges) was confirmed unacceptable by product. Do not revisit unless product changes the accuracy requirement.

---

## Phases

### Phase 1: Stabilize and Ship MVP (next session, ~2 hours)

The sliding window implementation is complete. This phase is about making it production-ready.

| Step | Task | Estimate | Depends On |
|------|------|----------|------------|
| 1.1 | Fix flaky `test_concurrent_requests_across_workers` — inject deterministic clock | 30 min | nothing |
| 1.2 | Implement Redis failure fallback (fail-open with `rate_limit_degraded` metric) | 45 min | nothing |
| 1.3 | Test Redis Sentinel failover behavior in staging | 30 min | 1.2 |
| 1.4 | PR review and merge to `main` | 15 min | 1.1 + 1.3 |

**Exit criteria**: All tests green, PR merged, rate limiting active in staging with fail-open fallback confirmed.

### Phase 2: Per-Endpoint Configuration and Plan Tiers (~1-2 sessions)

Move from static YAML config to dynamic per-plan limits. This enables the paid tier rollout.

| Step | Task | Estimate | Depends On |
|------|------|----------|------------|
| 2.1 | Add `/internal/plans/{api_key}` endpoint to user service (coordinate with team) | external | Phase 1 merged |
| 2.2 | Build `PlanLimitResolver` that fetches and caches plan limits (5 min TTL) | 1 hour | 2.1 |
| 2.3 | Add config hot-reload — watch `rate_limits.yaml` or expose admin endpoint | 45 min | Phase 1 merged |
| 2.4 | Write integration tests for plan-based limits with mock user service | 45 min | 2.2 |

**Exit criteria**: Rate limits vary by plan tier. Config changes apply without restart. User service dependency documented.

### Phase 3: Observability Dashboard (~1 session)

Prometheus metrics are already emitting from Phase 1. This phase builds the visibility layer.

| Step | Task | Estimate | Depends On |
|------|------|----------|------------|
| 3.1 | Create Grafana dashboard: rate limit hits by endpoint, by API key, by response code | 1 hour | Phase 1 metrics |
| 3.2 | Add alerting rule: sustained >80% rate limit usage for any key triggers PagerDuty | 30 min | 3.1 |
| 3.3 | Add `X-RateLimit-*` header documentation to public developer docs site | 30 min | Phase 1 merged |

**Exit criteria**: Ops team can see rate limit activity in Grafana. Alerts fire on sustained high usage. Public docs updated.

---

## Dependencies & Order

```
Phase 1 (no external deps)
    |
    +--> Phase 2 (needs user service team for plan lookup endpoint)
    |
    +--> Phase 3 (no external deps, can run in parallel with Phase 2)
```

- Phase 2 is blocked on the user service team building a plan lookup endpoint. Reach out early — this is the critical path for paid tier launch.
- Phase 3 can start as soon as Phase 1 merges. No dependency on Phase 2.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Redis Sentinel failover causes brief rate limit inconsistency | Medium | Low (few seconds of inaccurate counts) | Phase 1.3 tests this explicitly; fail-open means worst case is allowing extra requests, not blocking legitimate ones |
| User service plan lookup adds latency to every request | Medium | Medium | Cache with 5 min TTL in Phase 2.2; degrade to default limits if user service is unreachable |
| Rate limit bypass via API key rotation | Low | High | Out of scope for this work; flag to security team for separate review |

---

## Success Criteria

| Metric | Target | How to Measure |
|--------|--------|----------------|
| p99 latency overhead | < 20ms | Load test with `locust` (already scripted) |
| 429 response accuracy | > 95% | Integration test suite + load test analysis |
| Redis failure impact | Zero 500s | Kill Redis during load test, confirm fail-open |
| Time to detect abuse | < 5 min | Phase 3 alerting rule fires within 5 min of sustained high usage |
| Developer experience | Clear headers + docs | Manual review of 429 response and developer docs |

---

## Quick Start

```bash
# Resume work
cd C:/projects/orders-api
git checkout feat/api-rate-limiting

# Phase 1.1 — fix flaky test first
pytest tests/integration/test_rate_limit_e2e.py::test_concurrent_requests_across_workers -v

# Phase 1.2 — Redis fallback (start Redis, then kill it mid-test)
docker compose up -d redis
pytest tests/integration/test_rate_limit_e2e.py -v
docker compose stop redis
# Expect: requests succeed (fail-open), metric increments
```

**Read the handoff first** — the "What We Tried" section explains why we landed on sliding window and will save you from re-exploring token bucket or fixed window approaches.
