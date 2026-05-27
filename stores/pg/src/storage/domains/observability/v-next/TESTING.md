# Integration test gaps for `ObservabilityStoragePostgresVNext`

This directory ships a scaffold (`integration.test.ts`) of the
docker-backed tests that should land before the vNext adapter comes out of
draft. Each block is gated behind `PG_VNEXT_INTEGRATION_TESTS=1` so the
default `pnpm --filter @mastra/pg test` run keeps working without the
extra Postgres images. Set the env var locally to flip the blocks on.

## Suggested wiring

1. **Add Timescale + pg_partman services** to
   `stores/pg/docker-compose.yaml` (or a dedicated
   `docker-compose.vnext.yaml`) on separate ports so they don't collide
   with the existing `pg-test-db`:

   ```yaml
   services:
     timescale:
       image: timescale/timescaledb:latest-pg16
       container_name: 'pg-vnext-timescale'
       ports:
         - '5435:5432'
       environment:
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD: postgres
         POSTGRES_DB: mastra

     partman:
       # Use a current arm64-capable image. The adapter prefers pg_partman
       # 5.x semantics and keeps a 4.x compatibility fallback.
       image: huntress/postgres-partman:18.3
       container_name: 'pg-vnext-partman'
       ports:
         - '5436:5432'
       environment:
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD: postgres
         POSTGRES_DB: mastra
   ```

2. **Wire the connection envs** in `integration.test.ts`:
   - `PG_VNEXT_TIMESCALE_URL` (defaults to `postgres://postgres:postgres@localhost:5435/mastra`)
   - `PG_VNEXT_PARTMAN_URL` (defaults to `postgres://postgres:postgres@localhost:5436/mastra`)

3. **Optional: a `pretest:vnext` script** in `stores/pg/package.json` that
   spins up the extra services with `docker compose -f docker-compose.vnext.yaml up -d`
   and waits for them with `pg_isready` (mirroring the existing `pretest` hook).

## Coverage matrix

| Block                                  | Why it matters                                                                                                                                                  | Notes                                                                                                                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init() — Timescale path`              | The code path that calls `create_hypertable()` is currently untested. B1's earlier bug (passing the time column as `$N::name`) would have shipped without this. | Image with `timescaledb` extension installed. The block detects the extension and asserts `partitionMode === 'timescale'`.                                                            |
| `init() — pg_partman path`             | Same gap as Timescale. The collision detection between EXISTS lookup and `create_parent` (B-fix used `format('%I.%I', …)`) is only exercised here.              | Prefer an image with `pg_partman` 5.x so CI exercises the current `create_parent` contract; keeping one fallback test env on 4.x is optional.                                         |
| `init() — idempotency`                 | We rely on every DDL being `IF NOT EXISTS`. Catching regressions before they hit prod.                                                                          | Run on the default `pg-test-db` — no extensions needed. Call `init()` twice; second call must not throw and must leave the schema unchanged.                                          |
| `dangerouslyClearAll() post-condition` | B7 was a real foot-gun (hard-coded table list). A regression test guards against it.                                                                            | After clear, `SELECT count(*) FROM <every signal table>` should be 0; ditto the discovery cache.                                                                                      |
| Discovery — cold-start dedupe          | The cold-start stampede was a real bug. Without this test, the dedupe regresses silently.                                                                       | Fire N concurrent `getServiceNames` against an empty cache and assert exactly one underlying DB scan ran (instrument the DbClient or count rows in `mastra_observability_discovery`). |
| Discovery — stale SWR                  | Confirms stale callers return cached values immediately AND that a background refresh actually runs.                                                            | Seed the cache with `refreshedAt` past TTL; call discovery; assert returned values are the stale ones; wait a tick and assert `refreshedAt` advanced.                                 |
| Discovery — refresh failure surfaces   | The `console.warn` branch is currently unobserved.                                                                                                              | Mock the `client.query` for the refresh to reject; assert `console.warn` called with the cache key; assert subsequent reads retry instead of being permanently stuck.                 |
| OLAP — percentile golden values        | Numerical correctness check for `percentile_cont`.                                                                                                              | Insert a known distribution (e.g. 100 metrics with values 1..100). Assert `p50 = 50.5`, `p95 ≈ 95.05`, etc. Same dataset for time-bucketed mode.                                      |
| OLAP — `comparePeriod` shift           | `shiftRange` math is non-obvious for `previous_day` / `previous_week`.                                                                                          | Seed two known windows. Assert `previousValue`, `changePercent`, `costChangePercent` match expected.                                                                                  |
| `isSameConnectionTarget` warning       | The collision warning is the only thing standing between users and "observability shares the primary DB". A regression test keeps it loud.                      | Construct `PostgresStoreVNext` with identical and distinct connection configs; spy on the logger; assert exactly one warning in the identical case, zero in the distinct case.        |
| `listBranches` — branch-type narrowing | When the user passes a non-branch spanType, the short-circuit returns empty.                                                                                    | Insert spans of branch + non-branch types; query `listBranches({ filters: { spanType: 'MODEL_GENERATION' }})` and assert empty.                                                       |
| Delta polling — bigserial monotonicity | Sanity check that the cursor advances across partitions and chunks (Timescale) without gaps that delta polling would skip.                                      | Insert spans across two day boundaries (forcing two partitions on the native path); paginate by delta cursor; assert every row appears exactly once.                                  |

| Partition routing — today's row lands in today's partition (native) | The DDL declares partitions but nothing currently asserts a write actually hits the right child. | Insert one span; query `tableoid::regclass` for that row; assert it matches today's `mastra_span_events_pYYYYMMDD` child. |
| `partitioning.mode: 'native'` overrides auto-detected Timescale | The override exists but isn't covered. Important for staged rollouts where Timescale is installed but the operator wants to verify native partitioning first. | Install timescaledb; construct with `observability: { partitioning: { mode: 'native' } }`; assert `partitionMode === 'native'` and the tables are NOT hypertables. |
| Insert retry idempotency | `ON CONFLICT ("traceId", "spanId", "endedAt") DO NOTHING` is the contract retries rely on. | `createSpan(spanA)`; `createSpan(spanA)` again; assert `SELECT count(*) WHERE "spanId" = spanA.spanId` is exactly 1. Same shape for batchCreateSpans + the other signals' primary keys. |
| Feedback — string-valued round-trip | `valueString` vs `valueNumber` branching in `helpers.ts` is untested. | `createFeedback({ value: 'thumbs-up' })`; read back via `listFeedback`; assert `feedback[0].value === 'thumbs-up'`. Mirror with a numeric value and assert it flows through `valueNumber`. |
| `dangerouslyClearAll` resets `cursorId` sequence | The `RESTART IDENTITY` we added needs a regression guard. | Insert one row; clear; insert another; assert the new row's `cursorId === 1`. |
| pg_partman init concurrency | The TOCTOU between EXISTS check and `create_parent` is now caught via duplicate-error swallow; verify two concurrent inits both succeed. | Run two `init()` calls in parallel against the same pg_partman DB; assert both resolve and `part_config` has exactly one row per signal. |

## Out of scope here, worth noting

- **High-concurrency stress** — the `bigserial` concurrency caveat in
  `polling.ts` is documented as a known limitation. Confirming it doesn't
  bite at the target volume needs a load test, not a unit test; track it
  separately if it ever becomes relevant.
- **Postgres version matrix** — adapter targets PG 13+. CI should run against
  at least the oldest supported and current LTS.
