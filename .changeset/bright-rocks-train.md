---
'@mastra/core': minor
---

**Experiments now run the correct agent version**

When an experiment specifies `agentVersion`, the experiment pipeline now resolves and executes against that specific version instead of ignoring it. Previously, the version was stored as metadata but the agent always ran with its current default configuration.

**`entityVersionId` is now a first-class observability dimension**

A new `entityVersionId` field is available on all observability records (spans, metrics, scores, feedback, logs). This enables filtering traces by version and grouping OLAP queries (breakdowns, timeseries, aggregations) by version. This replaces the previous `resolvedVersionId` attribute which was buried in span attributes and unfilterable.

**`experimentId` propagated to agent spans**

Agent spans created during experiment execution now carry the `experimentId`, enabling trace-to-experiment cross-referencing.

**Scorer correlation context**

Scorers running in the experiment pipeline now receive full `targetCorrelationContext` (including `experimentId`), so scores emitted via observability carry experiment context.

**New experiment query filters**

`listExperiments` now supports filtering by `targetType`, `targetId`, `agentVersion`, and `status`. `listExperimentResults` now supports filtering by `traceId` and `status`.
