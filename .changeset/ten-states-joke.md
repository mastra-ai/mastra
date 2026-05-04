---
'@mastra/core': minor
---

**Added** `listBranches` and `getBranch` for querying named-entity invocations across traces, including nested ones. `listTraces` only returns root-rooted traces, so an entity that always runs as a child (e.g., an `Observer` agent inside a workflow) wasn't queryable before.

```ts
// Before: nested-only entities returned nothing
await store.listTraces({ filters: { entityName: 'Observer' } }); // []

// After: one row per AGENT_RUN, WORKFLOW_RUN, PROCESSOR_RUN, SCORER_RUN,
// RAG_INGESTION, TOOL_CALL, or MCP_TOOL_CALL span
await store.listBranches({ filters: { entityName: 'Observer' } });

// Plus: fetch the subtree at any span, with optional depth
const branch = await store.getBranch({ traceId, spanId, depth: 1 });
```

**Added** `getStructure({ traceId })` (canonical name for the lightweight trace skeleton; `getTraceLight` retained as a deprecated alias) and `getSpans({ traceId, spanIds })` (batch-fetch spans by id, used internally by `getBranch` to avoid pulling whole traces).
