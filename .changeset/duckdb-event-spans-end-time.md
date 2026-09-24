---
'@mastra/duckdb': patch
---

Event spans now read back with `endedAt` equal to `startedAt`, matching the ClickHouse and PostgreSQL stores. This includes event spans stored before this fix, which previously read back with `endedAt: null` and showed as running. New event spans are also stored as a single row.
