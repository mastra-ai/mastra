---
'@mastra/pg': minor
---

Added a `StarsStorage` implementation backed by Postgres, an `isStarred` JOIN on agent / skill reads, and a `visibility` filter on list queries.

Requires `@mastra/core` `>=1.35.0-0` so the new `@mastra/core/storage/domains/stars` subpath is available.
