# Metrics and Costing Implementation Plan

This was treated as a transport and storage-population project first, not a fresh schema-design project.

## Current State

The v0 end-to-end costing slice is now in place:

- `observability/mastra/src/metrics/estimator.ts` contains the embedded-snapshot v0 estimator.
- `observability/mastra/src/metrics/auto-extract.ts` emits token metrics and attaches row-local `costContext`.
- `packages/core/src/observability/types/metrics.ts` and `observability/mastra/src/context/metrics.ts` now support passing canonical per-row cost fields through metric transport.
- `packages/core/src/storage/domains/observability/record-builders.ts` persists canonical correlation fields from `correlationContext` and canonical cost fields from `costContext`.
- storage/query code already supports `estimatedCost` and `costUnit` in metric records and OLAP responses.
- the embedded pricing rollup is shipped with `@mastra/observability` from `observability/mastra/src/metrics/rollup.jsonl`.

The remaining work is primarily cleanup, documentation, and follow-up refinement rather than the initial implementation slice.

## Phase 1: Define the Costing Transport Contract

Status:

- completed for v0

- Explicit estimator input and result types now exist in `observability/mastra/src/metrics/estimator.ts`.
- Keep v0 narrow exactly as the docs specify: `provider + model`, embedded snapshot, one pricing row, and no hosted refresh path.
- Do not add a generic `status` field to the metric schema for v0. Execution success or failure is not reliably known at metric emission time.

If costing-specific outcome states are needed later, they should be introduced as a separate explicit field rather than overloading `status`.

## Phase 2: Move Pricing Logic Out of the Extractor

Status:

- completed for v0

- Pricing lookup and estimation now live in `observability/mastra/src/metrics/estimator.ts`.
- The estimator accepts the explicit v0 input and returns `estimatedCost`, `costUnit`, slim `costMetadata`, and a user-facing estimation status.
- Keep `observability/mastra/src/metrics/auto-extract.ts` focused on extraction and metric emission.

## Phase 3: Upgrade Metric Event Transport

Status:

- completed for v0

Metric events now carry:

- `timestamp`
- `name`
- `value`
- `labels`
- optional `correlationContext`
- optional `costContext`

This now provides the context needed for typed storage:

- `traceId`
- `spanId`
- `environment`
- `serviceName`
- entity hierarchy, when available
- typed costing fields such as `provider`, `model`, `estimatedCost`, `costUnit`, and `costMetadata`
- optional costing provenance and estimator metadata

This work landed in:

- `packages/core/src/observability/types/metrics.ts`
- `observability/mastra/src/context/metrics.ts`
- `packages/core/src/storage/domains/observability/record-builders.ts`

Note:

- The shared observability correlation context should also be used to tighten logging output over time, so logs and metrics derive canonical correlation fields from the same transport shape rather than relying on partially duplicated mappings.

## Phase 4: Emit Costing-Aware Model Metrics

Status:

- completed for the v0 token-metric path

For each model-generation span:

- keep emitting token metrics
- compute the row-local cost for each emitted token-related metric row
- populate `estimatedCost`, `costUnit`, and costing provenance on that same row

For v0, keep this simple:

- use the embedded pricing snapshot only
- compute best-effort row-local cost at emission time
- persist slim structured costing metadata in `costContext.costMetadata`

## Phase 5: Populate Typed Metric Storage Fields

Status:

- completed for the current storage shape

`buildMetricRecord()` now persists the stable typed context already supported by the storage schema.

That should include:

- `traceId`
- `spanId`
- `environment`
- `serviceName`
- entity hierarchy
- any other stable context that can be populated without abusing labels

## Phase 6: Add Tests

Status:

- completed for the initial v0 slice

Tests now exist in the three main layers:

- unit tests for pricing lookup and estimation math
- unit tests for auto-extraction behavior from model spans
- exporter and storage tests verifying metric rows persist the expected typed fields and stripped labels

Primary updated tests:

- `observability/mastra/src/metrics/auto-extract.test.ts`
- `observability/mastra/src/metrics/estimator.test.ts`
- `observability/mastra/src/context/metrics.test.ts`
- `observability/mastra/src/exporters/default.test.ts`
- `observability/mastra/src/integration-tests.test.ts`
- `packages/core/src/storage/domains/observability/record-builders.test.ts`

## Phase 7: Follow-up Work

The main follow-up work now is:

- update docs under `docs/` for the new costing metrics and query shape
- add a changeset
- evaluate whether server or client query APIs need explicit cost examples or dashboard-facing affordances
- decide whether any token-related metric rows should be excluded from costing in v0, even though the plumbing supports them
- revisit richer pricing selection only when the embedded one-row-per-model assumption is no longer sufficient

## Delivered v0 Slice

The implemented v0 slice now does the following:

1. Add v0 costing types plus the isolated estimator module.
2. Extend metric event transport and context so typed fields can flow through.
3. Populate `estimatedCost` / `costUnit` on emitted token-related model metrics.
4. Persist that context correctly and test it end to end.

This keeps the v0 implementation narrow:

- embedded pricing snapshot only
- exact `provider + model` matching
- prompt-threshold tier selection only
- row-local cost on existing token-related metric rows
