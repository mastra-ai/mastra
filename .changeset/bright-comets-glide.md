---
'@mastra/clickhouse': minor
---

Registered the new `mastra_stars` table / type so ClickHouse-backed deployments can hold star records.

Requires `@mastra/core` `>=1.35.0-0` so the new `@mastra/core/storage/domains/stars` subpath is available.
