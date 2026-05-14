---
'@mastra/libsql': minor
---

Added a `StarsStorage` implementation backed by libsql, an `isStarred` JOIN on agent / skill reads, and a `visibility` filter on list queries. A small `buildSelectColumnsWithAlias` helper is added for unambiguous column references in JOINs.

Requires `@mastra/core` `>=1.34.0-0` so the new `@mastra/core/storage/domains/stars` subpath is available.
