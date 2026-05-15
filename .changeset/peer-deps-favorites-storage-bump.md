---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mongodb': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
---

Bumped `@mastra/core` peer dependency floor to `>=1.34.0-0` so the new `@mastra/core/storage/domains/favorites` subpath is available. Older `@mastra/core` versions don't ship the `FavoritesStorage` base class these adapters now extend.
