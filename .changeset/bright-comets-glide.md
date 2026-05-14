---
'@mastra/clickhouse': minor
---

Registered the new `mastra_stars` table / type so ClickHouse-backed deployments can hold star records.

Requires `@mastra/core` `>=1.34.0-alpha.3` so the new `@mastra/core/storage/domains/stars` subpath is available.
