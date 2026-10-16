# Pinned ClickHouse trace compiler (2026-10-06)

`stores/clickhouse/src/storage/domains/observability/v-next/` as of `6babc6d526f`, the base the OSS-store
cases (`cases.ts`, X1–X31) were written and measured against. Their what-if variants (`scope.ts`: `w1`, `rs`,
`r1`, `sp`, `hourly`, …) rewrite that SQL; several of them have since landed in the compiler itself
(mastra#26567, #26912), so they no longer apply to `main`. Pinning keeps those experiments reproducible.

Changes from the original: the `../../../db/replication` imports point at the live store, and one operator
lookup in `trace-query.ts` is widened for Core's newer text operators (they reach the existing throw).

The Platform scripts (`mobs-*.ts`, `live.ts`) do not use this copy; they import mobs-query's compiler.
