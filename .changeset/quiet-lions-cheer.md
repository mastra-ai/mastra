---
'@mastra/libsql': minor
---

Added a `FavoritesStorage` implementation backed by libsql, an `isFavorited` JOIN on agent / skill reads, and a `visibility` filter on list queries. A small `buildSelectColumnsWithAlias` helper is added for unambiguous column references in JOINs.
