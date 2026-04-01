# ClickHouse vNext Observability Design

## Purpose

Use this file as the entry point for the ClickHouse `v-next` observability design. Cross-cutting decisions live in the shared doc; table-specific behavior lives in the per-table docs.

Important note:

- this document set is design documentation for the initial `v-next` implementation
- it is intended to guide implementation, not to remain a permanent second source of truth after the implementation and DDL/query code exist
- once `v-next` is implemented, the code and tests should become the authoritative source for ongoing behavior

## Design Set

- [Shared Design](./shared.md)
- [Trace Roots](./trace-roots.md)
- [Span Events](./span-events.md)
- [Metric Events](./metric-events.md)
- [Log Events](./log-events.md)
- [Score Events](./score-events.md)
- [Feedback Events](./feedback-events.md)
- [Discovery Design](./discovery.md)
- [Physical Types](./physical-types.md)

## Design Summary

The shared doc captures the cross-cutting v0 decisions, including:

- append-only ClickHouse storage across all five signals, with `ReplacingMergeTree` for tracing and `MergeTree` for the other four signals
- insert-only tracing with `span_events` plus `trace_roots`
- tracing retry-idempotency via a tracing-only `dedupeKey`
- broader shared observability context across logs, metrics, scores, and feedback, with `executionSource` as the execution-context column and `scoreSource` / `feedbackSource` as signal-specific source fields
- nullable `traceId` support for score and feedback events so those signals can still be recorded outside traces
- intentionally narrowed v0 ClickHouse trace-filter semantics: top-level string-only metadata equality via `metadataSearch`, and no trace `scope` filtering
- non-tracing signals intentionally remaining non-idempotent under retries in v0
- refreshable discovery helper tables as a best-effort optional subsystem, not a startup requirement for the core observability adapter
- day-granularity retention
- raw ClickHouse DDL as the source of schema definition

Use the shared doc for the common contract and the per-table docs for physical shape and query behavior.

## Scope

- Cloud ClickHouse physical design is the target for this work.
- Mastra runtime should continue writing through the standard storage interface via `DefaultExporter`.
- ClickHouse `v-next` should be designed around the batched create path used by `DefaultExporter`.
- Legacy observability methods outside that path are expected to be deprecated and should not drive `v-next` design decisions.
- Previous DuckDB or other storage implementations may be used as parity references, but they should not be treated as the design source of truth for ClickHouse `v-next`.
- New code should live under `stores/clickhouse/src/storage/domains/observability/v-next/`.
- Transition, migration, and cutover planning are intentionally out of scope for this design.
- The existing ClickHouse observability domain can remain separate while `v-next` is implemented.

## Rollout Order

1. Finalize the shared and per-table docs.
2. Implement raw ClickHouse DDL for the five signal tables, `trace_roots`, `discovery_values`, `discovery_pairs`, and their materialized views.
3. Implement writes and reads for the five signals.
4. Add targeted tests around the risky contract points:
   - tracing insert-only routing with ended-span-only persistence
   - tracing dedupe behavior for retried `span_events` / `trace_roots` writes
   - `trace_roots` population from root-span inserts
   - discovery helper refresh behavior and staleness expectations
   - per-table ordering
   - derived trace status semantics
   - trace `hasChildError`
   - `metadataRaw` vs `metadataSearch`
   - exact filter-surface behavior per signal
   - label/tag normalization
   - delete eventual consistency

Important note:

- this document set is intentionally about steady-state `v-next` design, not transition mechanics
- migration, cutover, and coexistence planning should not block v0 implementation work
