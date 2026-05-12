# Observability Delta Polling Final Design

## Goal

Add stateless incremental polling to the existing observability list endpoints without server-side cursor state.

This design is the restart target for implementation. It reflects the final product/API decisions and the backend-specific storage decisions we want to keep.

## Scope

Endpoints in scope:

- `listTraces`
- `listBranches`
- `listLogs`
- `listMetrics`
- `listScores`
- `listFeedback`

Backends in scope:

- ClickHouse v-next
- DuckDB
- in-memory store

## Product Semantics

### Existing endpoints only

Do not add separate `/updates` endpoints.

Incremental polling is added to the existing list endpoints via a mode switch.

### Modes

- default behavior when `mode` is omitted: page mode
- explicit page mode: `mode=page`
- incremental mode: `mode=delta`

### Shared mode rules

Page mode:

- accepts normal filters
- accepts pagination
- accepts orderBy
- may return `liveCursor`

Delta mode:

- accepts the same filters as page mode
- accepts `after`
- accepts `limit`
- does not accept pagination
- does not accept orderBy
- returns `delta` metadata
- returns `liveCursor`

Validation must reject mixed page/delta params and should return all validation issues, not just the first.

### Filter stability

`liveCursor` is intended to be reused only with the same filter set it came from.

If the client changes filters, it should treat that as a new query and obtain a new `liveCursor`.

We do not add a filter hash in v1.

## Public Cursor Contract

Public cursor type:

```ts
type LiveCursor = string;
```

The cursor is opaque at the API boundary. It must not expose storage-specific fields like `ingestedAt`, `tieBreaker`, or `cursorId`.

HTTP query shape should align with existing API conventions:

- `after=<string>`

Do not expose ingestion-order columns on returned trace/log/metric/score/feedback/branch objects.

## Response Shape

Page responses:

- normal list payload
- normal pagination metadata
- optional `liveCursor`

Delta responses:

- normal list payload
- `delta: { limit, hasMore }`
- `liveCursor`

`liveCursor` in page mode is a snapshot watermark for the filtered query, not a cursor for the visible page rows.

## Endpoint Semantics

### Traces

Delta semantics for `listTraces` are:

- return only newly listed traces
- do not re-emit previously listed traces as updates
- frontend should append/prepend by `traceId`, not do upsert replacement for changed traces

Late child spans may change an already-listed trace, but delta mode does not re-send that trace.

### Branches

Delta semantics for `listBranches` are:

- return only newly listed branch rows
- do not re-emit previously listed branches as updates

UI identity remains `traceId + spanId`.

### Logs, Metrics, Scores, Feedback

Delta semantics are append-style:

- return rows newly visible after the cursor

These signals do not need the trace/branch “newly listed only” distinction.

## Backend Design

### ClickHouse v-next

#### Design principles

- production backend
- cursor ordering must be DB-generated / DB-derived
- do not rely on app-generated ingestion timestamps or app-managed ordering
- do not use `ingestedAt` as the cursor primitive

#### Cursor primitive

Use a DB-generated sortable `UInt64` cursor id via `generateSnowflakeID()`.

The public `LiveCursor` remains opaque, but internally ClickHouse will use:

- `cursorId UInt64`

#### Trace and branch polling

Use lightweight DB-driven cursor tables:

- one for trace list polling
- one for branch list polling

These tables should be populated by materialized views, not by application-side second writes.

Reason:

- preserves DB-driven derivation from the authoritative base write path
- avoids app-managed cursor bookkeeping
- avoids partial-failure gaps between data insert and cursor insert

Trace delta source:

- list-trace cursor table
- one row when a trace first becomes listable

Branch delta source:

- list-branch cursor table
- one row when a branch first becomes listable

These tables are narrow append-only polling indexes, not full snapshots.

#### Other signals

Logs, metrics, scores, and feedback should also use DB-generated cursor ids for delta polling.

We should prefer DB-driven cursor derivation for ClickHouse here too, rather than app-managed second writes.

If that requires dedicated cursor tables or materialized views per signal, that is acceptable.

#### `ingestedAt`

Do not add `ingestedAt` to general ClickHouse signal/event tables as cursor infrastructure.

If we keep any ingestion-time column in ClickHouse, it should be only where explicitly useful for:

- debugging
- retention
- operational inspection

It is not part of the cursor contract.

#### Table ordering

Do not distort `ReplacingMergeTree` identity just to optimize polling.

For trace/branch polling, prefer dedicated cursor tables or polling-oriented derived tables over changing the primary replacing identity of the main tables.

### DuckDB

DuckDB is local-only / test-only.

Use explicit local cursor writes with a monotonic local counter or equivalent local-only mechanism.

Shared external behavior must match ClickHouse:

- traces: only newly listed traces
- branches: only newly listed branches
- other signals: append-style deltas

### In-memory

Use explicit local cursor bookkeeping.

Shared external behavior must match ClickHouse and DuckDB.

## Capability Gating

There are two separate gates:

### Existing new-observability route gate

Keep the existing `observability:v1.13.2` gate for new observability routes that already depend on newer core support.

This protects page-mode compatibility when newer `@mastra/server` runs against older `@mastra/core`.

### Delta feature gate

Additive feature:

- `observability-delta-polling`

This gate applies specifically to delta polling behavior.

Additionally, the active store must explicitly advertise per-endpoint delta support through runtime capabilities.

If delta is requested and the store does not advertise support, return a clear `501`.

## Compatibility Rules

- page mode must continue to work with older / legacy stores where possible
- delta mode must fail closed when unsupported
- do not rely on importing new runtime storage symbols from older `@mastra/core`
- preserve backward-compatible request/response shapes where possible

## Testing Requirements

We want one shared behavioral test suite across:

- in-memory
- DuckDB
- ClickHouse v-next

Must-cover behaviors:

- page mode default still works
- `mode=delta` rejects mixed page params
- omitted `after` in delta mode returns no backfill and returns `liveCursor`
- traces delta returns only newly listed traces
- branches delta returns only newly listed branches
- logs/metrics/scores/feedback delta returns only rows after cursor
- `limit + 1` handling sets `hasMore` correctly
- cursor monotonicity across successive writes
- same-filter-set expectation is documented and reflected in tests
- server returns `501` when delta feature or store capability is missing

## Non-Goals

These are not part of v1:

- server-side cursor state
- SSE / streaming implementation
- filter hash embedded in cursor
- exact re-emission of updated traces in delta mode
- forcing identical internal implementations across all backends

## Follow-on SSE Direction

If we later add SSE/streaming:

- keep the same `LiveCursor` contract
- use the same backend cursor sources
- treat SSE resume as “continue after cursor”

The polling cursor model is the compatibility anchor for future streaming work.
