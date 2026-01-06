---
"@mastra/core": minor
"@mastra/pg": patch
"@mastra/mssql": patch
"@mastra/upstash": patch
"@mastra/mongodb": patch
"@mastra/libsql": patch
"@mastra/cloudflare": patch
"@mastra/cloudflare-d1": patch
"@mastra/clickhouse": patch
"@mastra/dynamodb": patch
"@mastra/lance": patch
---

Added a unified `transformScoreRow` function in `@mastra/core/storage` that provides schema-driven row transformation for score data. This eliminates code duplication across 10 storage adapters while maintaining store-specific behavior through configurable options:

- `preferredTimestampFields`: Preferred source fields for timestamps (PostgreSQL, Cloudflare D1)
- `convertTimestamps`: Convert timestamp strings to Date objects (MSSQL, MongoDB, ClickHouse)
- `nullValuePattern`: Skip values matching pattern (ClickHouse's `'_null_'`)
- `fieldMappings`: Map source column names to schema fields (LibSQL's `additionalLLMContext`)

Each store adapter now uses the unified function with appropriate options, reducing ~200 lines of duplicate transformation logic while ensuring consistent behavior across all storage backends.
