---
'@mastra/pg': minor
---

Added a `StarsStorage` implementation backed by Postgres, an `isStarred` JOIN on agent / skill reads, and a `visibility` filter on list queries.

Requires `@mastra/core` `>=1.34.0-alpha.3` so the new `@mastra/core/storage/domains/stars` subpath is available.
