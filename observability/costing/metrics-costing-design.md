# Metrics Costing Design

## Status

Working design draft based on the 2026-03-19 costing exploration.

This document is intended to capture the emerging design direction for adding monetary cost estimates to the new observability metrics system and dashboard.

## Problem

The new observability metrics system already captures token-based usage metrics, but it does not yet capture monetary cost estimates.

We want the dashboard to support cost-related views without over-complicating:

- metric emission
- storage shape
- OLAP querying
- backend compatibility

## Current Context

Today, the system already emits token-related metrics from `observability/mastra/src/metrics/auto-extract.ts`.

The new observability APIs already support:

- aggregate queries
- breakdown queries
- time series queries
- percentile queries
- discovery/filter endpoints

The current design direction assumes:

- token usage remains the primary raw signal
- cost estimates are additional derived values attached to those usage metrics
- some pricing staleness is acceptable if it materially simplifies the design
- pricing data should still come from a real pricing-data pipeline rather than being hardcoded ad hoc in metric emitters

## Backend Context

Production expectations should assume ClickHouse is the primary analytics datastore.

Expected production shape:

- metric data is emitted at execution time
- that data is written to a durable queue
- an external ingestion process pulls from the queue and writes into ClickHouse
- a separate API layer serves analytical queries against that data

DuckDB remains relevant for local/smaller-scale backends and backend-parity work, but it is not the primary production architecture target.

Current design intent:

- DuckDB and ClickHouse schemas should stay as similar as practical
- they do not need to be identical in every implementation detail
- ClickHouse-specific tradeoffs should be considered explicitly in later design review, not ignored

Current ClickHouse v0 leaning:

- partition metric data by time to make retention easy
- start with a simple `ORDER BY (name, timestamp)`
- revisit the physical layout later using real query telemetry

## Goals

- Add estimated monetary cost to the metrics system in a way that is simple to query in the dashboard
- Keep the storage shape compact enough for high metric volumes
- Preserve a clean OLAP query model
- Support both token and cost analysis from the same metric row set
- Keep pricing-calculation details available for debugging and provenance
- Improve backend consistency across supported analytical backends where practical

## Non-Goals

- Building a full historical pricing-recomputation system in v1
- Preserving every historical estimate version in storage
- Solving recursive eval-trace attribution for the first dashboard version
- Finalizing the exact product scope of the dashboard MVP

## Rollout Scope

### Version summary

To keep the rollout disciplined, it helps to separate:

- what v0 actually needs to support
- what the schema/design should merely leave room for in v1

Current summary:

- v0 is a narrow embedded-snapshot costing system
- v1 is where hosted refresh, richer matching, and stronger backend optimizations should land

### v0

The initial costing rollout should stay intentionally narrow.

Assumptions:

- `@mastra/observability` ships with a local embedded snapshot of pricing data
- runtime costing uses that local snapshot only
- there is only one pricing row per `provider + model`
- no complex pricing-row selection algorithm is needed beyond direct lookup by `provider + model`
- estimator input stays narrow:
  - `tokenCount`
  - `tokenType`
  - `totalInputTokens`
  - `totalOutputTokens`
  - `provider`
  - `model`
- cost is stored directly on token-related metric rows
- ClickHouse-backed pricing lookup is not required
- materialized views are not required up front

This means v0 can avoid:

- effective-window selection
- multi-row resolution for one model/provider
- hosted refresh complexity in the runtime path
- advanced precedence rules between competing pricing rows
- richer pricing qualifiers like service tier, region, endpoint variant, or cache TTL
- pre-optimizing expensive analytical queries before real usage data exists

### v1

More advanced pricing-row selection can be added later.

Expected v1 concerns:

- local pricing-table persistence and hosted refresh/sync
- multiple rows for one `provider + model`
- regex-capable lookup
- `effectiveStart` / `effectiveEnd`
- hosted refresh and newer-version selection
- richer matching qualifiers
- richer estimator input context
- ClickHouse-specific query optimization such as materialized views
- possible OLAP API expansion for better multi-measure and per-trace analytics

So the design should preserve room for those fields, but v0 does not need to fully exercise them.

## Pricing Data Architecture

### External pricing source pipeline

The costing system should assume there is an external pricing-data pipeline, separate from normal runtime metric emission.

Preferred shape:

- an external daily job scrapes or fetches pricing inputs from provider sites and APIs
- that job normalizes the data into Mastra’s pricing-rule format
- the normalized pricing data is published through a hosted pricing API

This keeps provider scraping and normalization out of the hot application path.

### Embedded pricing snapshot in `@mastra/observability`

The `@mastra/observability` package should likely ship with a recent embedded pricing snapshot.

Why:

- works offline
- works in restricted-network environments
- avoids requiring a pricing fetch on first run
- gives the runtime a deterministic fallback even when hosted refresh is unavailable

This snapshot does not need to be perfect. It needs to be recent enough to provide reasonable estimates out of the box.

For v0, this embedded snapshot should be treated as the primary pricing source used by runtime costing.

### Local pricing persistence

Mastra should likely persist pricing data in storage as its own table rather than treating it as an implicit runtime-only cache.

Why:

- gives the runtime a durable local source of pricing data
- avoids repeated remote fetches in long-running deployments
- allows pricing data to be shared across process restarts
- provides a clean source for estimation logic used during metric emission

Current direction:

- add a dedicated pricing-data table to storage
- treat that table as the attached local pricing dataset used by observability costing logic

This is separate from the metrics table.

Even if the pricing table is not a classic OLAP fact table, it is still reasonable to store it in the same observability/OLAP database:

- operationally simpler
- keeps observability-related data in one place
- avoids introducing a second storage system just for pricing data

This is more relevant for later versions than for v0.

For v0:

- the embedded module snapshot is sufficient
- runtime pricing lookup does not need to depend on ClickHouse or another external store
- local pricing-table persistence can be deferred until the refresh/sync path is introduced

### Draft v1 schema

The current draft should stay simple: one `pricing_data` table.

Purpose:

- stores locally available pricing data used for runtime estimation
- keeps provider/model selection easy
- leaves most pricing details flexible inside JSON blobs

Draft columns:

- `id` string not null
- `provider` string not null
- `model` string not null
- `publishedAt` timestamp not null
- `cachedAt` timestamp not null
- `effectiveStart` timestamp nullable
- `effectiveEnd` timestamp nullable
- `costingData` json not null
- `metadata` json nullable

Interpretation:

- `id` should match the upstream identifier from Mastra’s hosted pricing API when available
- `provider` and `model` are the main lookup keys
- `publishedAt` represents when Mastra created/published this pricing row in the hosted pricing store
- `cachedAt` represents when this pricing row was written or refreshed into the local cache
- `effectiveStart` / `effectiveEnd` represent the intended pricing-applicability interval when Mastra knows it
- `costingData` holds the actual pricing structure used by estimation logic
- `metadata` holds provenance, refresh, and debugging context

This means the local table is best understood as a local cache of Mastra’s remote pricing store, not as the primary authoring system.

Likely `costingData` contents:

- input/output/cache rates
- service-tier-specific prices
- threshold rules
- modality-specific prices
- other structured pricing details needed by the estimator

Important rule:

- row-level pricing effectivity should live in `effectiveStart` / `effectiveEnd`
- `costingData` should not carry its own competing effective-date intervals

If pricing changes across different effective windows:

- create multiple rows
- each row gets its own `effectiveStart` / `effectiveEnd`
- each row carries the pricing structure for that window only

Likely `metadata` contents:

- source URL
- source kind
- source confidence
- snapshot version
- fetched timestamp
- embedded-vs-remote origin
- parser/debug notes

Useful indexes:

- `(id)`
- `(provider, model, effectiveStart, effectiveEnd)`
- `(provider, model, publishedAt)`
- `(cachedAt)`

Optional future additions if needed:

- a synthetic `id`
- `isActive`
- `source`

### `costingData` shape direction

The runtime model should be:

1. look up the best pricing row for the model/provider being used
2. read that row’s `costingData`
3. run estimation logic against that structured pricing data

So `costingData` needs to be structured enough for direct runtime use, not just archival storage.

Current lean:

- prefer one robust Mastra-defined `costingData` schema
- make it flexible enough to represent the pricing models we already know about
- include an explicit schema version
- avoid multiple unrelated blob shapes if we can
- prefer one execution path for pricing evaluation, even if most models only need a single default tier

Why:

- runtime estimation code is much simpler if it reads one known shape
- validation is easier
- migrations are easier to reason about
- a shared schema makes the hosted API, local cache, and estimator all speak the same language

Suggested approach:

- `costingData.schemaVersion`
- `costingData.data`
- optionally `costingData.kind`
- decode `data` according to `schemaVersion`

This is better than allowing every row to invent its own arbitrary structure.

That said, the schema should still be flexible:

- not every model will use every section
- many rows will only need simple base input/output pricing
- more complex models can use additional optional sections

Practical recommendation:

- do not start with multiple incompatible costing-data schemas unless a real use case forces it
- start with one Mastra schema that is intentionally extensible
- version that schema explicitly so it can evolve safely later

### Draft `costingData` sketch

The current sketch should optimize for:

- easy runtime evaluation
- one evaluator path
- optional complexity
- future extension without changing the whole shape

Illustrative TypeScript-style shape:

```ts
type CostingData = {
  schemaVersion: 'v1';
  kind?: 'model_pricing';
  data: CostingDataV1;
};

type CostingDataV1 = {
  currency: 'USD';
  tiers?: TierRule[];
  fallback?: FallbackPricing | null;
};

type CostMeter =
  | 'input_tokens'
  | 'output_tokens'
  | 'input_cache_read_tokens'
  | 'input_cache_write_tokens'
  | 'input_audio_tokens'
  | 'input_image_tokens'
  | 'output_audio_tokens'
  | 'output_image_tokens'
  | 'output_reasoning_tokens'
  | 'image_generation'
  | 'voice_minutes'
  | 'tool_calls'
  | 'search_queries';

type MeterPricing = {
  unit: 'token' | 'image' | 'minute' | 'call' | 'query' | string;
  pricePerUnit: number;
  minimumCharge?: number | null;
  metadata?: Record<string, unknown>;
};

type TierRule = {
  when?: PricingCondition[];
  meters: Partial<Record<CostMeter, MeterPricing>>;
  metadata?: Record<string, unknown>;
};

type PricingCondition =
  | {
      field:
        | 'total_input_tokens'
        | 'service_tier'
        | 'cache_ttl'
        | 'reasoning_enabled'
        | 'reasoning_effort'
        | 'endpoint_variant'
        | 'provider_region';
      op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
      value: string | number | boolean | Array<string | number>;
    };

type FallbackPricing = {
  behavior: 'no_estimate' | 'use_base_only';
};
```

Interpretation:

- top-level `schemaVersion` controls how `data` is decoded
- optional `kind` leaves room for future non-model pricing payloads without inventing a second outer envelope
- within `data`, all pricing is expressed as `tiers`
- simple models use a single default tier
- more complex models add conditional tiers
- `fallback` controls what happens if the pricing data is incomplete for a request

This shape is intentionally:

- simple for base input/output pricing
- expressive enough for threshold and tier cases
- extensible for future meters without redefining the whole schema

### Example: simple input/output model

```json
{
  "schemaVersion": "v1",
  "kind": "model_pricing",
  "data": {
    "currency": "USD",
    "tiers": [
      {
        "meters": {
          "input_tokens": { "unit": "token", "pricePerUnit": 0.00000015 },
          "output_tokens": { "unit": "token", "pricePerUnit": 0.0000006 }
        }
      }
    ]
  }
}
```

### Example: model with cache pricing and long-context tier

```json
{
  "schemaVersion": "v1",
  "kind": "model_pricing",
  "data": {
    "currency": "USD",
    "tiers": [
      {
        "meters": {
          "input_tokens": { "unit": "token", "pricePerUnit": 0.00000125 },
          "output_tokens": { "unit": "token", "pricePerUnit": 0.00001 },
          "input_cache_read_tokens": { "unit": "token", "pricePerUnit": 0.000000125 }
        }
      },
      {
        "when": [
          { "field": "total_input_tokens", "op": "gt", "value": 200000 }
        ],
        "meters": {
          "input_tokens": { "unit": "token", "pricePerUnit": 0.0000025 },
          "output_tokens": { "unit": "token", "pricePerUnit": 0.000015 }
        }
      }
    ]
  }
}
```

### Runtime evaluation expectation

At estimation time, the executor should:

1. load the best matching pricing row for `provider + model`
2. build a small evaluation context from the request/usage data
3. scan conditional tiers in array order and use the first one that matches
4. if no conditional tier matches, use the default tier
5. compute row-local cost for each emitted metric row using the chosen tier’s meters

This keeps the runtime contract straightforward:

- lookup one row
- evaluate one known pricing shape
- emit row-local estimates

### Why an all-tier model may be better

Benefits:

- one evaluator path for all models
- simpler schema than a model with separate base pricing, override tiers, and extra modifier machinery
- thresholded and non-thresholded models use the same structure
- most rows will still be simple because they only need one default tier

Current caveat:

- if we later need true stackable surcharges or additive modifiers, we may need to add a modifier concept back
- for v1, tiers alone may be sufficient

### Current lookup and estimation assumptions

Current direction from discussion:

- pricing lookup should support regex matching in v1
- if no pricing row matches, do not save a cost estimate
- instead, save explicit metadata indicating a `no_match` outcome
- refresh precedence can stay simple: use the newest available pricing version
- the estimator should receive roughly the same pricing-relevant context that we also plan to persist on metric rows

This suggests:

- row lookup can use exact and regex-capable matching
- estimation failure should be observable, not silent
- cost-related metadata on metric rows should include enough context to explain match or no-match outcomes

### v0 estimator input contract

For v0, the estimator input should stay intentionally narrow.

Preferred input fields:

- `tokenCount`
- `tokenType`
- `totalInputTokens`
- `totalOutputTokens`
- `provider`
- `model`

Interpretation:

- `tokenCount` is the numeric usage for the current emitted metric row
- `tokenType` identifies what kind of usage the row represents, for example:
  - `input_tokens`
  - `output_tokens`
  - `input_cache_read_tokens`
  - `input_cache_write_tokens`
  - `output_reasoning_tokens`
  - other supported meters
- `totalInputTokens` and `totalOutputTokens` give enough request-level context for threshold-based pricing in v0

Explicitly out of scope for v0:

- `service_tier`
- `provider_region`
- `endpoint_variant`
- `cache_ttl`
- other richer routing or deployment qualifiers

This is enough for the current intended v0 pricing scope:

- default pricing tiers
- over-threshold pricing based on total input size

It is not intended to solve all future pricing dimensions.

## Tier Semantics Draft

The all-tier model still needs explicit semantics so every runtime evaluates pricing the same way.

### Proposed rules

1. Every pricing row must have exactly one default tier.

Meaning:

- a default tier is a tier with no `when` conditions
- it acts as the fallback pricing for the row

Why:

- guarantees there is always a base pricing shape
- keeps simple models trivial
- avoids undefined behavior when no conditional tier matches

2. Conditional tier conditions are combined with implicit `AND`.

Meaning:

- all conditions inside one tier’s `when` array must match for that tier to match

Why:

- simplest mental model
- easy to evaluate
- enough for the pricing cases we have discussed so far

3. If multiple conditional tiers match, choose the first matching tier in array order.

Meaning:

- the order of tiers in the array is the precedence order

Why:

- simplest possible rule
- authored order is already preserved in JSON
- avoids an extra field and extra sorting logic

4. If no conditional tier matches, use the default tier.

Why:

- matches the “one default tier” requirement
- keeps runtime behavior predictable

5. Tier evaluation should produce one effective meter table for the request.

Meaning:

- the chosen tier defines the prices used for the request
- row-local metric cost is then computed from that chosen tier’s meters

Current lean:

- do not merge multiple matching tiers in v1
- choose the first matching conditional tier in array order

That keeps evaluation simple and avoids ambiguous partial overrides.

### Practical consequences

Simple model:

- one default tier only

Thresholded model:

- one default tier
- one or more conditional tiers for threshold cases, ordered from most specific to least specific

Service-tier model:

- one default tier
- one or more conditional tiers keyed by `service_tier`, ordered by precedence

### Why “one winning tier” is attractive

Benefits:

- simple evaluator
- deterministic behavior
- easy to explain/debug
- avoids complicated merge semantics
- avoids the need for a separate precedence field

Tradeoff:

- less expressive than layered or merged rule systems
- if we later need combinable conditions from multiple rule families, we may need a more advanced model

For v1, “one default tier plus first matching conditional tier” looks like the strongest default.

### Array vs record for tiers

Current lean:

- keep `tiers` as an ordered array
- do not switch to a record/map keyed by precedence

Why arrays are preferable:

- preserves authored order naturally
- makes precedence straightforward
- serializes cleanly in JSON without special handling

Why a record/map shape is less attractive:

- makes order semantics less explicit
- turns a sequencing problem into a map-shape problem

So the practical v1 rule is:

- `tiers` is an array
- precedence is array order
- first matching conditional tier wins

Tradeoff:

- this is less normalized than a dataset-plus-rules model
- but it is much easier to reason about and probably a better fit for the first implementation

Important note:

- `publishedAt` and `effectiveStart` are different concepts
- `publishedAt` means when Mastra created the hosted pricing row
- `effectiveStart` means when the pricing is intended to apply

Why add optional `effectiveStart` / `effectiveEnd` now:

- they are low-cost to add
- they future-proof historical pricing behavior
- they avoid overloading `publishedAt` with pricing-effectivity semantics

Caveat:

- if one `costingData` blob eventually contains internally mixed effective intervals, row-level `effectiveStart` / `effectiveEnd` become only an approximation
- for v1, they should be treated as the best row-level applicability window, not necessarily the full internal rule-history model

### Refresh behavior

`@mastra/observability` should attempt to refresh pricing data when the local pricing snapshot/table is stale.

Preferred behavior:

- staleness threshold is configurable
- refresh is best-effort
- if refresh fails, the runtime keeps using the last known local pricing data
- restricted-network and serverless environments should continue to function from the embedded snapshot and/or stored table data

This keeps the system operational even when hosted pricing refresh is unavailable.

### Estimation logic location

`auto-extract.ts` should use pricing data from the attached local database when generating estimates.

But the pricing logic itself should not live inline inside `auto-extract.ts`.

Preferred shape:

- move pricing lookup and cost-estimation logic into its own module
- `auto-extract.ts` imports and calls that module

Why:

- isolates pricing complexity from metric-extraction code
- makes costing easier to test directly
- gives the system a cleaner place for future pricing-rule matching logic

## Architecture Overview

Preferred high-level flow:

1. External pricing job fetches provider pricing inputs and publishes normalized pricing data.
2. `@mastra/observability` ships with an embedded pricing snapshot.
3. Runtime loads pricing data from:
   - embedded snapshot
   - local pricing table
   - optional hosted refresh when stale
4. Metric auto-extraction emits token rows and computes best-effort row-local cost estimates using the attached pricing data.
5. Metrics are stored with:
   - usage in `value`
   - cost in `estimatedCost`
   - cost unit in `costUnit`
   - pricing provenance/calculation details in `metadata`

## Design Direction

### 1. Cost lives on token-related metric rows

The current preferred direction is to store estimated cost on the same metric rows that already carry token usage.

Why:

- keeps usage and cost physically colocated
- lets the dashboard query cost and tokens from the same filtered row set

Important constraint:

- the cost stored on a row must be the cost for that row only
- do not duplicate full request-total cost across multiple sibling rows

Examples:

- `mastra_model_total_input_tokens` row stores input token count in `value` and input-token cost in `estimatedCost`
- `mastra_model_input_cache_read_tokens` row stores cache-read token count in `value` and cache-read cost in `estimatedCost`

### 2. Metric rows become a small multi-measure model

The metric row is trending toward a multi-measure shape:

- usage in `value`
- cost in `estimatedCost`

This is still compatible with OLAP-style queries as long as the query API can choose which numeric field to aggregate.

### 3. Store only the cost fields that need to be queryable

Preferred first-class cost columns:

- `estimatedCost`
- `costUnit`

Preferred metadata contents:

- pricing source
- pricing version or snapshot identifier
- cost-computed timestamp
- pricing-rule explanation details
- other provenance/debug fields

This keeps the hot OLAP path simple while preserving calculation context.

### 4. Canonical dashboard dimensions should be first-class columns

Preferred first-class metric columns:

- `status`
- `provider`
- `model`
- `environment`
- `serviceName`

Rationale:

- they are stable product-level dimensions
- they are likely to be filtered/grouped often
- first-class columns reduce backend-specific query behavior

Stored metric rows should treat these columns as canonical rather than relying on duplicated label copies.

### 5. DuckDB should still support label-aware `groupBy`

Even with more canonical columns, DuckDB should gain label-aware `groupBy`.

Why:

- it brings DuckDB closer to current in-memory behavior
- it supports remaining flexible label dimensions
- it avoids repeated schema promotion for every future grouping need

So the target direction is:

- canonical dimensions as columns
- flexible/ad hoc dimensions still available through label-aware grouping

### 6. Per-request dashboard metrics should mean per-trace metrics

For Mastra product semantics, “per request” should mean “per trace.”

That means:

- per-request cost = sum of all relevant cost-bearing metric rows for a trace
- per-request token usage = sum of all relevant token-bearing metric rows for a trace

This matches the user-visible execution boundary, even if one trace contains multiple internal model/tool/provider calls.

Caveat:

- evals can create additional traces
- evals can recursively trigger more eval traces

That should be treated as a future modeling refinement rather than a v1 blocker.

## Query Model Direction

### Single-measure and multi-measure queries

Longer term, a measure-selection model is still a reasonable direction:

- keep a simple measure-selection concept
- allow multiple measures in aggregate/breakdown/timeseries queries when useful

Illustrative shape:

```json
{
  "name": ["mastra_model_total_input_tokens"],
  "groupBy": ["entityName"],
  "measures": [
    { "field": "value", "aggregation": "sum", "as": "inputTokens" },
    { "field": "estimatedCost", "aggregation": "sum", "as": "inputCost" }
  ],
  "filters": { "timestamp": { "start": "...", "end": "..." } }
}
```

Why this is attractive:

- one filtered scan can produce both token and cost aggregates
- cost does not need a special parallel query API
- the API remains close to normal OLAP mental models

Current v0 decision:

- do not add `measures` to the public/storage OLAP query APIs yet
- keep the existing value-first response shape
- return cost fields alongside value when available:
  - aggregate: `value` plus optional `estimatedCost` and `costUnit`
  - breakdown: per-group `value` plus optional `estimatedCost` and `costUnit`
  - time series: per-point `value` plus optional `estimatedCost`, with series-level `costUnit`
- percentiles remain value-only

Why v0 stays simpler:

- the current shape already lets callers retrieve value and cost together from one filtered scan
- it preserves backward compatibility for existing value-based queries
- it avoids adding a more complex multi-measure contract before there is a stronger product need

Constraint:

- percentiles should likely remain single-measure for now

### Query optimization expectations

Some higher-level analytics, especially per-trace cost views, may eventually benefit from pre-aggregation.

Examples:

- materialized views grouped by `traceId`
- pre-aggregated per-trace cost summaries
- other derived views for expensive dashboard queries

Current rollout expectation:

- v0 should not require these optimizations up front
- start with direct queries over the base metrics rows
- add materialized views later if real query timings show they are needed

This implies an important operational practice:

- keep observability on metrics-query performance itself
- capture which query patterns are slow
- use that data to decide which materializations are worth adding

## Alternative Summary Path: Root-Span Total Cost

Another possible optimization path is to persist total request/execution cost on the root trace span itself.

Possible shape:

- add `costEstimate`
- add `costUnit`

on tracing span records, with the main intended use being:

- populated on the root span
- representing total cost for the whole trace/request

Why this is attractive:

- makes “cost per request” / “cost per trace” queries much easier
- avoids having to sum many metric rows at query time for common request-level cards
- fits the Mastra semantic model where one trace is one request

Main difficulty:

- maintaining a running total during execution is stateful and potentially awkward
- child model/tool spans may complete at different times
- retries, partial failures, async execution, and distributed/durable execution can make live accumulation tricky

Current lean:

- this is a good idea to keep on the table
- but it should not require a mutable runtime running-sum mechanism in v0

Better implementation directions, if pursued later:

1. derive root-span total cost after the fact in ingestion/storage/query layers
2. populate it only when a trace is finalized, not incrementally on every child event
3. treat it as a summary/optimization field, not the source of truth

Relationship to the main design:

- row-local cost on token metrics should remain the source of truth
- root-span total cost, if added, should be a derived convenience summary

## `costingData` Versioning Expectations

The presence of `schemaVersion` is intentional.

It should give Mastra room to evolve the pricing-expression model over time without pretending the v0 schema must solve every future case.

Working expectation:

- `v0` uses a deliberately simple pricing-expression model
- future schema versions can introduce more expressive matching/calculation models if needed

That means the current all-tier model should be understood as:

- good enough for the first implementation
- not necessarily the final long-term expression language for pricing

## Required Data-Path Changes

### Propagation gaps to fix

Token metrics need to reliably carry and persist:

- `traceId`
- `environment`
- `serviceName`

Without those fields:

- per-trace cost/request views are weak
- environment/service filtering is unreliable

### Storage/query model changes

The metrics storage and OLAP layers will need to evolve to support:

- first-class `estimatedCost`
- first-class `costUnit`
- first-class `provider`
- first-class `model`
- first-class `status`
- reliable `environment` and `serviceName` propagation
- label-aware `groupBy` in DuckDB
- measure selection and likely multi-measure aggregation

### Typed column strategy

The current accepted direction is to keep a broad typed-column surface for metrics, but distinguish between:

- hot-path dashboard columns
- typed reporting/correlation columns
- fields that should stay out of metrics entirely

Hot-path typed columns:

- `timestamp`
- `name`
- `entityType`
- `entityId`
- `entityName`
- `parentEntityType`
- `parentEntityId`
- `parentEntityName`
- `rootEntityType`
- `rootEntityId`
- `rootEntityName`
- `provider`
- `model`
- `status`
- `environment`
- `source`
- `serviceName`
- `value`
- `estimatedCost`
- `costUnit`

Typed but reporting-oriented columns:

- `traceId`
- `spanId`
- `userId`
- `organizationId`
- `resourceId`
- `runId`
- `sessionId`
- `threadId`
- `requestId`
- `experimentId`

Not part of the metrics hot path:

- `scope`

Why:

- the entity id/type/name hierarchy is a real product-level dimension set and belongs on the hot path
- reporting/correlation ids should remain queryable, but do not need to shape the first ClickHouse physical optimization pass
- `scope` is better recovered from traces when needed

### Filter contract direction

The filter schema should expose the real DB-backed fields that are intended to be queryable.

That includes:

- the promoted typed columns above
- explicit reporting/correlation fields
- `labels` as a generic escape hatch for remaining flexible dimensions

At the same time, the API can still provide friendlier convenience behavior where useful.

Example:

- user-facing `entityName` filter may reasonably match both stored `entityName` and stored `entityId`

But that convenience should not replace explicit low-level filters for:

- `entityId`
- `parentEntityId`
- `rootEntityId`
- and other real stored fields

## Tradeoffs

### Benefits of the current direction

- simpler than a full recomputation/versioned-cost system
- easier dashboard queries
- cleaner path to side-by-side token and cost analytics

### Accepted tradeoffs

- stored estimates may become stale as pricing data improves
- query-time recomputation is not the primary path in v1
- some future pricing use cases may still require richer request-level context

## Remaining Open Questions

- What exact request/response shape should the multi-measure OLAP API use?
- What exact refresh policy and staleness defaults should `@mastra/observability` use?
- What exact tier semantics do we want to lock in for v1?
- Do we want user-provided pricing overrides in v1, or only Mastra-managed pricing data?
- Which dashboard cards/charts are truly in MVP versus later?
- Does MVP need percentile/request-count views, or only totals/breakdowns?

## Immediate Next Steps

- Translate this design direction into concrete metric schema changes
- Map current dashboard queries into:
  - safe now
  - blocked on propagation
  - blocked on DuckDB/query API work
- Define the minimal OLAP API change needed for measure selection and multi-measure support
