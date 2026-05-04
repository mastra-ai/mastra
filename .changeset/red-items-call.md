---
'@mastra/core': minor
'@mastra/clickhouse': minor
---

**Added `listInvocations` and `getBranch` for working with non-root spans**

`listTraces` returns one row per trace, keyed off the root span. That makes it impossible to answer questions like _"every run of the `Observer` agent across the system"_ when `Observer` only ever runs nested inside other agents or processors — those invocations exist in the data but aren't surfaceable without knowing every parent that triggered them.

Two new APIs close that gap.

**`listInvocations({ filters?, pagination, orderBy })`**

Lists named-entity invocation spans across all traces. Each row is a single invocation, including nested ones. Repeated invocations of the same entity within one trace surface as separate rows. Filters apply to the invocation span itself (not the trace root) — `entityName`, `threadId`, `resourceId`, `tags`, etc. all match the invocation, which is what you want.

The set of "named-entity invocation" span types is fixed and excludes sub-operations:

```
AGENT_RUN, WORKFLOW_RUN, PROCESSOR_RUN, SCORER_RUN,
RAG_INGESTION, TOOL_CALL, MCP_TOOL_CALL
```

Sub-operations (`MODEL_STEP`, `WORKFLOW_STEP`, `SCORER_STEP`, `MEMORY_OPERATION`, `RAG_EMBEDDING`, etc.) are intentionally not listable — they're internal to a containing invocation, not separately invoked entities.

```ts
// Before: "show me every Observer run" was not expressible
await store.listTraces({ filters: { entityName: 'Observer' } });
// → []  (Observer never runs as a root span)

// After
await store.listInvocations({ filters: { entityName: 'Observer' } });
// → [{ spanId, traceId, entityName: 'Observer', startedAt, ... }, ...]
```

Compared to making `listTraces` filters match nested spans (the alternative considered): this keeps `listTraces` semantics stable (one row per root-rooted trace, root-only filters), and lets each call surface the unit the caller actually wants — whole traces or individual invocations.

**`getBranch({ traceId, spanId, depth? })`**

Returns the subtree of spans rooted at a given span, optionally bounded to `depth` levels of descendants. Pairs with `getStructure` (the new canonical name for `getTraceLight`, which is retained as a deprecated alias) for progressive trace exploration: render the lightweight skeleton up front, fetch full subtree data lazily as a user expands branches.

```ts
const skeleton = await store.getStructure({ traceId });            // lightweight tree
const branch   = await store.getBranch({ traceId, spanId, depth: 1 }); // anchor + immediate children
```

`depth` semantics:
- omitted → full subtree
- `0` → just the anchor
- `1` → anchor + immediate children
- `N` → anchor + N levels of descendants

The default implementation (in `ObservabilityStorage` base) fetches the full trace and walks the parent/child chain in memory, so every backend that supports `getTrace` gets `getBranch` for free without a backend-specific code path.

**ClickHouse**

Adds a new `mastra_invocations` table (ReplacingMergeTree, ordered by `(spanType, startedAt, traceId, dedupeKey)`) populated by an incremental materialized view (`mastra_mv_invocations`) that filters `mastra_span_events` to the invocation span types above. New deployments get the table during `init()`; existing deployments pick it up on the next init via additive `CREATE TABLE IF NOT EXISTS`. No data migration needed — historical span_events do not backfill, but new spans flow in automatically. Tracing retention TTL applies to the new table.

**Out of scope for this change**

`listInvocations` is implemented for the in-memory and ClickHouse v-next backends. Other storage backends (DuckDB, Postgres, LibSQL, MongoDB, MSSQL) currently throw "not implemented" for `listInvocations`; follow-ups will add per-backend implementations. `getBranch` works against all backends via the default in-memory walk.
