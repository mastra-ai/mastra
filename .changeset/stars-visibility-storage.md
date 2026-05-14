---
'@mastra/core': minor
'@mastra/libsql': minor
'@mastra/pg': minor
'@mastra/mongodb': minor
'@mastra/clickhouse': minor
'@mastra/cloudflare': minor
---

Added a stars storage domain plus `visibility` and `starCount` fields on stored agents and skills across the storage adapters.

**`@mastra/core`** introduces:

- A new `StarsStorage` abstract domain (`star` / `unstar` / `isStarred` / `listStars` / `deleteStarsForEntity`) keyed by `(userId, entityType, entityId)`, registered as `mastra_stars` via the new `TABLE_STARS` / `STARS_SCHEMA` constants, exposed at the new `@mastra/core/storage/domains/stars` subpath.
- A `StorageVisibility` type (`'private' | 'public'`) plus `visibility` and `starCount` fields on `StorageAgentType` / `StorageSkillType` (and their snapshot / create / update / list-input types).
- New list-input options on agents and skills: `entityIds`, `pinStarredFor`, `starredOnly` — used to enable starred-first ordering and starred-only filtering.
- A `StorageSkillFileNode` type for round-tripping the full skill file tree.
- An `InMemoryStarsStorage` implementation plus visibility / star plumbing on the inmemory and filesystem agent + skill adapters.

**`@mastra/libsql`** and **`@mastra/pg`** add a `StarsStorage` implementation, an `isStarred` JOIN on agent / skill reads, and a `visibility` filter on list queries. A small `buildSelectColumnsWithAlias` helper is added to libsql for unambiguous column references in JOINs.

**`@mastra/mongodb`** adds `visibility` and `starCount` fields on the stored agents and skills schemas.

**`@mastra/clickhouse`** and **`@mastra/cloudflare`** register the new `mastra_stars` table / type.

All additions are backward compatible at the row level: existing rows without `visibility` or `starCount` continue to work, and the new fields and domain APIs are opt-in. The storage adapters listed here now require a `@mastra/core` version that exports `@mastra/core/storage/domains/stars` — see each adapter's updated `peerDependencies` floor. The HTTP handlers, editor namespace, and playground UI that consume these APIs ship in follow-up PRs.
