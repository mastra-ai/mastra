---
'@mastra/core': minor
---

Added a stars storage domain plus `visibility` and `starCount` fields on stored agents and skills.

- New `StarsStorage` abstract domain (`star` / `unstar` / `isStarred` / `listStars` / `deleteStarsForEntity`) keyed by `(userId, entityType, entityId)`, registered as `mastra_stars` via the new `TABLE_STARS` / `STARS_SCHEMA` constants, exposed at the new `@mastra/core/storage/domains/stars` subpath.
- A `StorageVisibility` type (`'private' | 'public'`) plus `visibility` and `starCount` fields on `StorageAgentType` / `StorageSkillType` (and their snapshot / create / update / list-input types).
- New list-input options on agents and skills: `entityIds`, `pinStarredFor`, `starredOnly` — used to enable starred-first ordering and starred-only filtering.
- A `StorageSkillFileNode` type for round-tripping the full skill file tree.
- An `InMemoryStarsStorage` implementation plus visibility / star plumbing on the inmemory and filesystem agent + skill adapters.

All additions are backward compatible at the row level: existing rows without `visibility` or `starCount` continue to work, and the new fields and domain APIs are opt-in.
