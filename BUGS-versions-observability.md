# Bugs: Versions / Observability / Evaluation

Discovered during architecture exploration on 2026-04-13.

## Critical

### 1. ~~Experiments don't apply agentVersion — they only store it as metadata~~ ✅ FIXED
**Location**: `packages/core/src/datasets/experiment/index.ts` (`resolveTarget()`)

`resolveTarget()` now accepts `agentVersion` and passes it to `mastra.getAgentById()` / `mastra.getAgent()` for version-aware agent resolution.

### 2. Agent version resolution mutates in-place — no cloning
**Location**: `packages/editor/src/namespaces/agent.ts` (`applyStoredOverrides()`)

`applyStoredOverrides()` mutates the singleton agent instance via `agent.__setRawConfig()`. There's a WeakMap preserving code defaults, but concurrent versioned calls race on the same instance. You can't safely resolve two different versions of the same agent in parallel.

**Impact**: Concurrent version resolution produces unpredictable results. Experiment concurrency with different versions is unsafe.

**Fix**: Clone the agent instance before applying overrides, or use an immutable config resolution pattern.

## High

### 3. ~~`resolvedVersionId` not available as a trace filter~~ ✅ FIXED (generalized to `entityVersionId`)
**Location**: `packages/_internal-core/src/storage/domains/shared.ts`, all storage adapters

Added `entityVersionId` as a first-class field in the shared observability schema (`contextFieldsBase` and `commonFilterFields`). Implemented in in-memory, DuckDB, and ClickHouse storage adapters. `resolvedVersionId` in span attributes is deprecated in favor of `entityVersionId` as a top-level span/metadata field.

### 4. ~~No reverse query: experiments by agentVersion~~ ✅ FIXED
**Location**: `packages/core/src/storage/types.ts`, all experiment storage adapters

Added `targetType`, `targetId`, `agentVersion`, and `status` filters to `ListExperimentsInput`. Implemented in inmemory, libsql, pg, and mongodb.

### 5. Scores have no agentVersionId or experimentId filter (legacy domain)
**Location**: `packages/core/src/storage/domains/scores/base.ts`

The legacy scores domain can be queried by `scorerId`, `runId`, `entityId`, `traceId/spanId` — but not by `agentVersionId` or `experimentId`. The observability domain now has `entityVersionId` and `experimentId` on score records and supports filtering.

**Status**: Partially fixed — the observability domain (new canonical store) supports these filters. Legacy domain is being deprecated.

## Medium

### 6. No `listTraces()` or query API at the framework level
**Location**: `packages/core/src/mastra/index.ts`

`mastra.observability.getRecordedTrace({ traceId })` exists but there's no `listTraces()` or filtered query. Developers must drop to raw storage.

### 7. ~~No reverse query: experiments by traceId~~ ✅ PARTIALLY FIXED
`experimentId` is now propagated to `AGENT_RUN` spans during experiment execution. Traces can be filtered by `experimentId` in the observability storage. `ListExperimentResultsInput` now accepts `traceId` as a filter.

### 8. ~~No reverse query: experiment results by traceId~~ ✅ FIXED
**Location**: `packages/core/src/storage/types.ts`, all experiment storage adapters

Added `traceId` and `status` filters to `ListExperimentResultsInput`. Implemented in inmemory, libsql, pg, and mongodb.

### 9. ~~Feature-gated tabs have no indication of why they're hidden~~ ✅ FIXED
**Location**: `packages/playground/src/domains/agents/components/agent-page-tabs.tsx`

Tabs are now always visible. Disabled tabs show a tooltip explaining what's required to enable them.

---

## Changes Made (2026-04-13)

### Framework-level fixes
1. **Experiment version resolution**: `resolveTarget()` applies `agentVersion` during experiment execution
2. **Experiment → span propagation**: `experimentId` is passed via `tracingOptions.metadata` to `AGENT_RUN` spans
3. **Scorer correlation context**: `targetCorrelationContext` (with `experimentId`, `entityType`, `targetType`) passed to scorers during experiment runs
4. **`entityVersionId` as first-class field**: Added to shared observability schema (`contextFieldsBase`, `commonFilterFields`), `CorrelationContext`, record builders, and all storage adapters (inmemory, DuckDB, ClickHouse)
5. **Agent span metadata**: `entityVersionId` set on `AGENT_RUN` span metadata from `resolvedVersionId`; `resolvedVersionId` in attributes deprecated
6. **Experiment query filters**: Added `targetType`, `targetId`, `agentVersion`, `status` to `ListExperimentsInput`; `traceId`, `status` to `ListExperimentResultsInput`

### UI fixes
7. **Feature-gated tabs**: Always visible with disabled state + tooltip explaining requirements
8. **Experiment → version cross-link**: Agent version shown in experiment page header as clickable link to agent editor at that version; also clickable in agent-scoped experiment results panel
9. **Trace → experiment/version cross-link**: `experimentId` (linked to experiment page) and `entityVersionId` (linked to agent editor when entity is agent) shown in trace dialog details

### Remaining work
- Bug #2: Agent instance cloning for concurrent version resolution (out of scope — complex, separate PR)
- Bug #5: Legacy scores domain deprecation (migration in progress, separate workstream)
- Bug #6: Framework-level `listTraces()` API (design decision needed, separate PR)
