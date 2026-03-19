# Costing Next Steps

## Current State

The initial v0 runtime costing slice is now implemented.

Primary references:

- `observability/costing/metrics-costing-design.md`
- `observability/costing/metrics-costing-design-review.md`
- `observability/costing/implementation_plan.md`

Current implementation status:

- model token metrics can now carry:
  - `provider`
  - `model`
  - `estimatedCost`
  - `costUnit`
  - slim `costMetadata`
- the estimator lives in `observability/mastra/src/metrics/estimator.ts`
- the embedded snapshot lives in `observability/mastra/src/metrics/rollup.jsonl`
- auto-extracted model token metrics now attach row-local `costContext`
- storage/query code already supports `estimatedCost` alongside `value`

## v0 Guardrails

- Use the embedded pricing snapshot only
- Assume one pricing row per `provider + model`
- Avoid richer qualifiers like service tier, region, endpoint variant, or cache TTL
- Do not require ClickHouse-backed pricing lookup
- Do not require materialized views up front

## Practical Next Steps

The remaining work is mostly polish and follow-up:

1. Update broader docs outside `observability/costing/` if product-facing observability docs should mention estimated cost fields.
2. Add a changeset.
3. Decide whether all currently emitted token-related metric rows should carry cost in v0, or whether some should be excluded intentionally.
4. Keep watching real pricing/source churn and only expand beyond exact `provider + model` matching when needed.

## ClickHouse Notes To Preserve

- Production target is ClickHouse, but current ClickHouse code in the repo should not be used as a design reference
- Current v0 leaning:
  - partition by time for retention
  - simple `ORDER BY (name, timestamp)`
  - revisit using real query telemetry later

## Review Focus Left

The two most meaningful review threads still left open are:

- per-trace cost analytics and when materialization becomes worthwhile
- ClickHouse-specific implications beyond the initial v0 layout
