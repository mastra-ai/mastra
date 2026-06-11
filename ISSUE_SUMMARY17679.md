# Issue #17679: Postgres connection failing irregularly when observability is configured

- **URL:** https://github.com/mastra-ai/mastra/issues/17679
- **Author:** julien_58947 (Discord) / reported via `daneatmastra`
- **Assignee:** NikAiyer
- **Labels:** bug, Workflows, Storage, Observability (AI Telemetry), discord, status: waiting for author, status: needs follow up, impact:high, effort:medium, trio-tracery
- **Branch:** `fix/pg-connection-observability`

## Reporter's Summary

User connected a Mastra server to a **Supabase Postgres** via the **transaction pooler**. They use workflows, agents, and tools, persisting chats and workflow snapshots in Supabase. **Observability** is also configured.

The setup works but is unstable: roughly **1 in 3–4 runs** fail at startup with:

```
Unhandled Rejection: Error: canceling statement due to statement timeout
    at PgDB.alterTable (file:///var/task/node_modules/@mastra/pg/dist/index.js:2971:13)
    at PgDB.createTable (file:///var/task/node_modules/@mastra/pg/dist/index.js:2602:7)
    at _ObservabilityPG.init (file:///var/task/node_modules/@mastra/pg/dist/index.js:10360:5)
    at Promise.all (index 3)
    at PostgresStore.init (file:///var/task/node_modules/@mastra/core/dist/chunk-P4AZAEQP.js:176:5)
    at PostgresStore.init (file:///var/task/node_modules/@mastra/pg/dist/index.js:14967:7)
```

Removing observability from the Mastra server eliminates the timeout (workaround).

After upgrading to the latest packages, the user reports the failure mode **shifted** to a different store (Memory) with `EAUTHTIMEOUT` errors — also during table creation in Supabase. Their PostgresStorage is configured at the Mastra root and Memory inherits it.

## Key Stack Trace Signals

- Failure happens inside `PostgresStore.init` → `Promise.all(...)` over per-namespace stores → `_ObservabilityPG.init` → `createTable` → `alterTable`.
- `Promise.all (index 3)` means at least 4 sub-stores (operational, memory, ai-tracing/observability, others) are being initialized **concurrently** on the shared connection pool.
- Postgres error "canceling statement due to statement timeout" comes from the Supabase pooler enforcing `statement_timeout` while a long-running DDL waits on a lock.
- The new `EAUTHTIMEOUT` after upgrade suggests pool exhaustion / connection acquisition timeout — consistent with the pool being saturated when multiple init paths each grab their own client and then block on each other.

## Working Hypothesis

`PostgresStore.init` fans out initialization of several Postgres-backed stores (operational, memory, observability/AI tracing, etc.) **in parallel** against the **same pg pool**. Against Supabase's transaction pooler (which has aggressive `statement_timeout` and a small per-connection budget), concurrent DDL (`CREATE TABLE` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) racing on the same tables / pool exhausts available connections, holds locks, and exceeds the statement timeout — causing the intermittent "canceling statement due to statement timeout" failure.

The fix likely needs to **serialize** the per-store `init` calls (or at least the DDL portion) and/or guard against running ALTER/CREATE concurrently on the same connection. Removing observability reduces the fan-out from 4 → 3 (or fewer) initializers and pushes the failure rate below the threshold the user notices.

---

## Stage 1: Analyze — root cause

### Code paths walked

1. **`MastraCompositeStore.init()`** — `packages/core/src/storage/base.ts` (~lines 403–470)
   - Iterates `ALL_DOMAINS` and calls `domain.init()` for every registered store.
   - Calls are pushed into an `initTasks: Promise<void>[]` array and `await Promise.all(initTasks)` is the final step.
   - Result: every domain's `init()` runs **concurrently** against the same shared `pg.Pool`.
   - Note: issue #16782 already taught child composites to delegate to the parent `init()`. That fix does not change the parallel fan-out at the top level — it only avoids duplicate inits.

2. **Domain `init()` implementations** (e.g. `stores/pg/src/storage/domains/observability/index.ts` ~line 55, `domains/memory/index.ts` ~line 175)
   - Each domain runs **multiple DDL statements sequentially per domain**: `createTable`, `alterTable` (add missing columns / TIMESTAMPZ), `createDefaultIndexes`, `createCustomIndexes`.
   - The observability domain in particular calls `createTable` for `mastra_ai_spans`, then `alterTable` to add `requestContext`, then default indexes (5+), then custom indexes.
   - The memory domain runs even longer chains: 3 `createTable` calls (threads/messages/resources), an optional OM `createTable`+`alterTable`, plus `alterTable` for `resourceId` on messages, OM indexes, and default+custom indexes.

3. **`PgDB.createTable()` and `PgDB.alterTable()`** — `stores/pg/src/db.ts` (~lines 661–756 and 1115–1165)
   - `createTable` itself is DDL-heavy: `setupSchema` + `generateTableSQL` + `client.none(CREATE TABLE)` + per-column `alterTable` for TIMESTAMPZ defaults + `setupTimestampTriggers` + the `mastra_ai_spans` primary-key migration path.
   - `alterTable` iterates each `ifNotExists` column with its own `client.none()` call.
   - The static `schemaSetupRegistry` only dedupes `CREATE SCHEMA` calls — every other DDL statement is independent.

4. **`PoolAdapter.none()` / `tx()`** — `stores/pg/src/db.ts` (~lines 111–178)
   - `none()` calls `this.$pool.query(...)` directly. Each statement acquires a **fresh** `PoolClient` from the pool.
   - `tx()` is only used by the few places that genuinely need a transaction; the bulk of init-time DDL does **not** share a connection across statements.

### What that means against a Supabase transaction pooler

- A single `PostgresStore.init()` fans out into ~20 parallel domain inits.
- Each domain serially issues 5–10+ DDL statements via `pool.query()`, so on the wire we see a **burst of dozens of independent connection acquisitions**, each holding the connection only for one statement.
- In Supabase's pgBouncer transaction mode each `pool.query()` becomes its own server-side transaction, and Supabase enforces a relatively short `statement_timeout`.
- Several domains call `CREATE TABLE IF NOT EXISTS mastra_*` and `ALTER TABLE mastra_* ADD COLUMN IF NOT EXISTS ...` at the same time. PostgreSQL serializes DDL on the same relation via `AccessExclusiveLock`, so the losers of the race **wait** behind the winner. While waiting, the pooler's `statement_timeout` keeps ticking, and the waiter eventually gets cancelled with the exact error in the stack trace:
  - `canceling statement due to statement timeout` thrown from `PgDB.alterTable → PgDB.createTable → ObservabilityPG.init → Promise.all (index 3)`.
- Removing observability shrinks the init fan-out enough that the lock-contention window stops crossing the timeout threshold — exactly the workaround the user reports.
- After the recent package upgrade, the failure surface moved to memory's init under `EAUTHTIMEOUT`, which is `pg.Pool` failing to acquire a client within the configured `connectionTimeoutMillis`. That is the **same root cause** observed one layer up: when the pooler is saturated by the parallel DDL burst, new clients can't be checked out in time. The user's note that "PostgresStorage is configured at the root and Memory inherits it" matches the composite delegation pattern from #16782 — Memory's domain still ultimately runs through the parent's parallel `Promise.all`.

### Root cause (one-line)

`MastraCompositeStore.init()` runs every PG-backed domain's DDL **in parallel** on a shared `pg.Pool`. Against a Supabase transaction pooler with a `statement_timeout` budget, the resulting DDL lock contention + connection-checkout burst is enough to intermittently exceed `statement_timeout` (or `connectionTimeoutMillis` after the recent upgrade) — and adding the Observability domain pushes the burst past the threshold for ~1 in 3–4 runs.

### Why this only repros on Supabase pooler

- Local Postgres has no `statement_timeout` and a much larger effective connection budget, so the lock contention completes well within the timeout window.
- Supabase transaction-pooler tier has a small per-database connection budget and a `statement_timeout` measured in single-digit seconds. Both invariants the current parallel init path violates.

---

## Stage 2: Proposed fix direction (sketch — not yet implemented)

Likely smallest reasonable change, ordered cheapest to most invasive:

1. **Serialize PG-backed domain `init()` calls inside `PostgresStore.init`** (override at the PG composite layer rather than touching `MastraCompositeStore` semantics globally). This keeps the SQLite/libSQL parallel init path untouched (issue #16782's regression suite stays green) but eliminates the DDL fan-out for PG.
2. **Run all init-time DDL inside a single connection / single transaction** by reusing one acquired `PoolClient` (or one `tx`) for the whole composite init. This eliminates both the connection-checkout storm and removes intra-pool DDL races, and makes the whole init atomic — partial-failure recovery becomes simpler.
3. **Document Supabase transaction-pooler caveats** for `statement_timeout` and recommend session-mode for first-boot / migration phases, with link to the workaround.

Step (1) alone should be enough to close the user's reported failure; step (2) is the proper fix and is what we should ship. Step (3) is a docs follow-up regardless.

### Open questions before writing the fix

- Do any non-PG domains under the PG composite override `init` in a way that assumes parallel scheduling? (Quick scan: no — all PG domains are independent DDL only.)
- Are there reasonable tests we can add that don't require a live Supabase pooler? Yes — mock `pg.Pool.query` to assert sequential ordering of `init()` calls and to assert all DDL during init flows through a single client when option (2) is taken.

---

_Last updated by build agent during issue triage._
