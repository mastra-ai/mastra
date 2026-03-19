# Metrics Costing Design Review

## Scope

Review of the current costing design direction in:

- `observability/costing/metrics-costing-design.md`
- `observability/costing/journal/2026-03-17.md`
- `observability/costing/journal/2026-03-19.md`

Primary review lens:

- identify weak assumptions
- identify hidden complexity
- identify likely failure modes
- assess fit for the real production backend direction, where ClickHouse is expected to be primary

## Findings

Status summary:

- Findings `#1`, `#2`, `#5`, and `#7` are now mostly scoped to later versions rather than blocking v0.
- Finding `#6` has been resolved by design-doc cleanup.
- Findings `#3` and `#4` remain the most meaningful active review items.

### 1. Pricing-row selection is under-specified

This is primarily a v1 concern, not necessarily a v0 blocker.

If v0 is explicitly scoped to:

- one embedded pricing snapshot
- one row per `provider + model`
- direct lookup only

then complex row-selection logic can reasonably be deferred.

However, the current design still does not define a sufficiently explicit algorithm for the later v1 shape.

Current fields and assumptions imply selection may depend on:

- `provider`
- `model`
- regex matching
- `effectiveStart` / `effectiveEnd`
- possibly future qualifiers like `service_tier`, region, or endpoint variant

But the design does not yet define:

- exact match precedence vs regex precedence
- how to resolve multiple matching rows
- how `publishedAt` participates in selection
- how effective-window selection interacts with lookup

Risk:

- silent mispricing
- backend-specific behavior drift
- estimator logic becoming ad hoc in implementation

Recommendation:

- for v0, document the narrow lookup assumption explicitly
- for v1, define the row-selection algorithm before expanding beyond one-row-per-model/provider

### 2. The all-tier model is clean, but likely less expressive than the design currently implies

This is also best understood as a staged-scope concern.

If v0 explicitly adopts:

- a simple all-tier model
- a narrow embedded snapshot
- limited pricing complexity

then the expressive limitations are acceptable.

The real risk is if the design implicitly treats the v0 tier model as the final long-term representation.

Potential trouble cases:

- orthogonal adjustments such as service tier plus regional uplift
- cache TTL-dependent pricing combined with other conditions
- future additive surcharges

With “first matching tier wins,” these cases may require:

- row explosion
- duplicated tier combinations
- awkward encoding in one ordered list

Risk:

- the data model looks simpler than the real pricing problem
- later pricing sources may force a schema rethink sooner than expected

Recommendation:

- document the expressive limits of the v0 tier model explicitly
- treat it as a deliberate first-version simplification
- rely on `schemaVersion` to introduce richer pricing-expression models later if needed

### 3. On-row cost is good for totals, but weaker for per-trace distribution analytics than the current design suggests

Storing row-local cost on token-related metric rows makes aggregates and breakdowns straightforward.

But “cost per request” for Mastra means “cost per trace,” which requires:

1. summing row-local costs by `traceId`
2. then performing higher-level aggregation or percentile analysis over those per-trace totals

That is a second aggregation stage, not a simple direct aggregate over metric rows.

Risk:

- percentile/distribution support may be harder than the design currently implies
- the OLAP API may need more than simple measure selection

Recommendation:

- explicitly acknowledge that per-trace cost analytics are a derived second-stage aggregation problem
- treat materialized views or other pre-aggregations as likely future optimizations
- do not force those optimizations into v0 unless real query timings justify them
- instrument metrics-query latency so future optimization work is driven by observed bottlenecks

### 4. The current design is still too centered on DuckDB given that ClickHouse is the real production target

The design heavily emphasizes DuckDB label-aware `groupBy`, but production expectations point toward ClickHouse as the primary backend.

Clarifying production shape:

- metrics are emitted at execution time
- written to a durable queue
- ingested into ClickHouse by an external process
- queried through a separate API layer

So the real production design questions are not only about local storage schemas. They are also about:

- ingestion shape
- ClickHouse schema and query behavior
- how much backend parity is realistic between DuckDB and ClickHouse
- where it is acceptable for the two implementations to differ

That means the design should be justified first in terms of:

- ClickHouse schema evolution
- ClickHouse JSON column ergonomics
- ClickHouse query patterns for multi-measure metrics
- ClickHouse runtime lookup implications for pricing data

DuckDB matters, but it should be treated as a compatibility/backend-parity concern rather than the main architectural driver.

Risk:

- optimizing the design around the wrong backend constraints
- underestimating ClickHouse-specific implications

Recommendation:

- add a short ClickHouse-focused section to the design before implementation proceeds

### 5. “Store pricing data in the OLAP DB because it is simpler” is plausible, but not yet well-defended

The current design prefers storing `pricing_data` in the observability/OLAP database because it keeps observability data in one place.

This should be treated as a v1 question rather than a v0 blocker.

If v0 uses only the embedded pricing snapshot bundled with `@mastra/observability`, then runtime pricing lookup does not depend on ClickHouse-backed pricing storage yet.

That is operationally attractive, but the design does not yet address:

- runtime lookup latency expectations
- refresh/upsert patterns
- whether ClickHouse is an ideal runtime lookup store for the estimator path

This may still be the right choice, but it is not obviously right just because it reduces system count.

Risk:

- optimizing for operational simplicity while degrading runtime lookup behavior

Recommendation:

- for v0, explicitly scope runtime pricing lookup to the embedded snapshot
- for v1, explicitly justify ClickHouse-backed pricing lookup, or define a fallback local-memory/cache layer above it

### 6. The design doc still contains stale contradictions

Status:

- resolved

The priority/tier-order contradictions called out here have since been cleaned from the main design doc.

### 7. The estimator input contract is not specified early enough

This was a real gap earlier, but the current direction can now be narrowed substantially for v0.

For v0, a minimal contract appears sufficient:

- `tokenCount`
- `tokenType`
- `totalInputTokens`
- `totalOutputTokens`
- `provider`
- `model`

That should be enough for:

- default pricing
- threshold-based pricing driven by total input size

And it intentionally avoids richer qualifiers such as:

- `service_tier`
- region
- endpoint variant
- cache TTL

So this finding is now mostly a v1 concern:

- if richer pricing dimensions are added later, the estimator contract will need to expand deliberately

Remaining risk:

- the implementation should still define this contract explicitly in code rather than letting it remain informal

Recommendation:

- define the v0 estimator input type explicitly in code before finalizing metric-schema additions

## Open Questions

- Are `provider` and `model` sufficient as top-level pricing-row lookup keys once regex matching and reseller/provider variants are included?
- If ClickHouse is primary, what exact access pattern should the estimator use for pricing lookup?
- Should “no match” live only in metadata, or should metric rows also carry an explicit first-class estimation status field?
- For per-trace cost analytics, when should materialized views become justified instead of relying on raw second-stage aggregation?
- How much backend parity should be enforced between DuckDB and ClickHouse before backend-specific optimizations are allowed?

## Recommended Next Steps

1. Turn the accepted v0 estimator contract into an explicit type in code.
2. Keep the v1 pricing-row selection algorithm as a deferred design item rather than a v0 blocker.
3. Continue the ClickHouse-focused review around:
   - per-trace aggregation/materialization thresholds
   - ORDER BY / partition follow-up implications
   - acceptable DuckDB vs ClickHouse divergence

## ClickHouse Deep Dive Notes

This section reviews the current costing direction specifically against ClickHouse architecture and official ClickHouse guidance.

### A. The current metric-row direction is broadly compatible with ClickHouse

The current direction of:

- append-oriented metric ingestion
- first-class typed columns for canonical dimensions
- a small number of numeric measures
- optional semi-structured JSON for flexible metadata

is aligned with how ClickHouse is strongest.

Why:

- ClickHouse is optimized for append-heavy analytical workloads
- ClickHouse benefits strongly from typed columns used in filtering/grouping
- ClickHouse can store semi-structured JSON, but performs best when frequently queried fields are promoted to typed columns

This supports the current design choices to promote:

- `provider`
- `model`
- `status`
- `environment`
- `serviceName`
- `estimatedCost`
- `costUnit`

### B. Promoting canonical dimensions to columns is the right bias for ClickHouse

Official ClickHouse guidance strongly emphasizes that sort order / primary key design and typed columns dominate query performance.

Implication for the current plan:

- relying too heavily on JSON extraction for common dashboard dimensions would be a mistake
- first-class columns are the right default for frequently filtered/grouped dimensions
- JSON should be used for flexible or lower-value detail, not the hot path

This validates the current direction away from label-only canonical dimensions.

### C. The `costingData` JSON blob is acceptable in ClickHouse, but only if it stays off the hot query path

ClickHouse’s modern JSON support is much better than older approaches, and official guidance shows it can work well for semi-structured data.

But the important caveat is:

- JSON is best for flexible detail
- typed columns are still preferable for hot analytical access patterns

That means the current plan is sensible only if:

- `costingData` is primarily used by runtime estimation / debug flows
- dashboard queries do not depend on deep ad hoc extraction from `costingData`

If analytical queries start depending on `costingData` internals heavily, the design will likely fight ClickHouse’s strengths.

### D. ClickHouse makes materialized views a very credible optimization path for per-trace cost analytics

The review concern about per-trace cost being a second-stage aggregation problem is real.

But ClickHouse also provides a strong mitigation path:

- incremental materialized views
- aggregate-state tables
- pre-aggregated target tables

That means the current plan is reasonable as long as:

- v0 starts with direct queries
- future query latency is measured
- materialized views are introduced only where real bottlenecks exist

This is a good fit for ClickHouse specifically.

### E. Primary key / ORDER BY design will matter more than most of the current document acknowledges

Official ClickHouse guidance repeatedly stresses that physical ordering is one of the highest-leverage design decisions.

Implication:

- the future metrics table design will need deliberate ORDER BY choices based on actual query patterns
- this matters more than some of the JSON-vs-column discussion

Likely consequence for costing analytics:

- time should almost certainly be part of the physical ordering strategy
- common low-cardinality dimensions may need to participate too, depending on dominant dashboard filters

This is not something to finalize yet, but it should be treated as a central implementation concern for ClickHouse.

### F. ClickHouse is not a free pass for runtime pricing lookup simplicity

Even if pricing data is stored in the same ClickHouse deployment later, that does not automatically make it the ideal runtime lookup substrate.

Why:

- ClickHouse is primarily optimized for analytical scans and aggregations
- the costing evaluator wants a small, predictable, low-latency lookup path

This strengthens the staged decision already captured elsewhere:

- v0 should use the embedded module snapshot
- ClickHouse-backed pricing lookup can remain a later design question

One important later-version note:

- if pricing lookup ever does move closer to ClickHouse, ClickHouse dictionaries are likely a more natural fit than issuing ordinary table queries in the estimator hot path
- dictionaries are specifically designed for fast key-value style lookups and can be sourced from ClickHouse tables or HTTP-backed data

So the likely v1/vlater ClickHouse question is not just:

- “should pricing live in ClickHouse?”

It is also:

- “should runtime lookup use a ClickHouse dictionary or similar in-memory lookup layer rather than normal analytical table queries?”

### G. Low-cardinality optimization matters for this design

Official ClickHouse guidance highlights `LowCardinality` as a meaningful optimization for repeated string dimensions.

For the current costing/metrics plan, likely good candidates include:

- `provider`
- `status`
- `environment`
- possibly `serviceName`
- maybe `costUnit`

`model` is more debatable because its cardinality may be much higher.

This does not change the logical schema, but it is a useful implementation note for ClickHouse.

### H. Production ingestion shape strengthens the case for keeping metric emission simple

You described a production architecture where:

- metrics are emitted at execution time
- written to a durable queue
- ingested into ClickHouse by an external process
- queried through a separate API layer

That architecture reinforces one major design principle:

- do not make runtime metric emission depend on complex backend behavior

This supports:

- v0 embedded pricing snapshot
- simple row-local cost computation at emission time
- deferring heavier backend-specific optimizations to the ingestion/query layer

## ClickHouse-Specific Assessment

The current plan is not doing anything obviously foolish for ClickHouse.

What looks good:

- typed canonical columns
- on-row numeric cost
- JSON reserved mostly for flexible detail
- v0 embedded snapshot for runtime pricing lookup
- willingness to add materialized views later only if query timings justify them

What still needs care:

- do not let `costingData` become a hot analytical dependency
- do not over-index on DuckDB constraints when ClickHouse is the production target
- treat ORDER BY / primary-key design as a first-class future decision
- keep runtime pricing lookup independent from ClickHouse for v0

## ClickHouse Constraints To Revisit

These are the concrete ClickHouse-fit questions that look most worth discussing next.

### 1. Which columns must be typed and query-hot?

Current strong candidates:

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

This is the “don’t hide hot dimensions in JSON” question.

Additional candidate columns worth serious consideration:

- `traceId`
- `spanId`
- `userId`
- `organizationId`
- `resourceId`
- `runId`
- `sessionId`
- `threadId`
- `requestId`

Critical nuance:

- these are likely high-cardinality
- that does not mean they should be dropped
- it does mean they should probably be treated as reporting dimensions rather than core fast-path dashboard dimensions

ClickHouse-specific implication:

- keep them as typed columns if product value is real
- do not assume they belong early in the main ORDER BY strategy
- do not assume their queries will be as cheap as low-cardinality dashboard dimensions
- add later optimizations only if actual query demand justifies them

This suggests a practical split:

- fast dashboard dimensions:
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
- slower reporting dimensions:
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

Explicit non-goal for metrics hot path:

- `scope`

Rationale:

- `scope` is low-value on metrics relative to its storage/query cost
- if needed, scope-like build/version context can be recovered by linking back to traces

That split does not need a different schema.

It is mostly:

- a query-pattern expectation
- an ORDER BY decision
- and potentially a future projection/materialization decision

### 1a. Filter schema should expose DB-backed fields even if the product API also offers friendlier aliases

There is a separate but related query-contract issue:

- the filter schema should expose the real DB-backed fields that are intended to be queryable
- even if the product API also offers a friendlier convenience filter

Example:

- `entityName` as a user-facing filter may reasonably match both stored `entityName` and stored `entityId`
- but the schema should still expose explicit filters for:
  - `entityId`
  - `parentEntityId`
  - `rootEntityId`
  - and other real DB-backed fields

Why this matters:

- preserves power for advanced/reporting queries
- avoids forcing everything through overloaded convenience filters
- keeps the query contract aligned with the storage contract

Practical direction:

- keep user-friendly alias behavior where it improves UX
- also add explicit filter fields for the real stored columns

### 2. What should the first ORDER BY strategy optimize for?

This is likely the highest-leverage ClickHouse design choice and should be driven by expected dashboard filters.

Open shape questions:

- time-first only?
- time plus metric name?
- time plus common dimensions?
- should per-trace analysis get help from ordering, or from later materialization instead?

Current leaning:

- partition by time for retention management
- start with a simple `ORDER BY (name, timestamp)`

Why this is a reasonable v0 choice:

- aligns well with the current default dashboard query shape
- keeps the first physical design simple
- supports metric-specific queries over time
- avoids overfitting the base table to dimensions that may be better handled later with projections or materialized views

Important note:

- time-based partitioning already helps coarse pruning and retention
- `ORDER BY` should therefore focus on good clustering within a partition, not try to solve every query pattern at once

### 3. Which queries should remain raw, and which should eventually get materialized help?

Likely raw in v0:

- simple aggregates
- time series
- straightforward entity/provider/model breakdowns

Likely future candidates for materialized views:

- per-trace cost summaries
- per-trace percentile/distribution inputs
- any query pattern that repeatedly performs second-stage aggregation

### 4. How much backend parity is realistic between DuckDB and ClickHouse?

Ideal:

- same logical API
- same user-visible semantics

Likely reality:

- same logical contract where possible
- different physical optimizations underneath
- possible backend-specific implementation differences for JSON extraction, materialization, and optimization

### 5. If pricing data ever moves into ClickHouse-backed lookup paths, what abstraction should sit above it?

v0 answer:

- not needed; use embedded snapshot

Later-version question:

- ordinary table query
- in-process cache populated from ClickHouse
- ClickHouse dictionary-backed lookup

This is worth revisiting before any v1 runtime-refresh implementation.
