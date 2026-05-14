---
'@mastra/core': minor
---

Added a favorites storage domain plus `visibility` and `favoriteCount` fields on stored agents and skills.

- New `FavoritesStorage` abstract domain (`favorite` / `unfavorite` / `isFavorited` / `listFavoritedIds` / `deleteFavoritesForEntity`) keyed by `(userId, entityType, entityId)`, registered as `mastra_favorites` via the new `TABLE_FAVORITES` / `FAVORITES_SCHEMA` constants, exposed at the new `@mastra/core/storage/domains/favorites` subpath.
- A `StorageVisibility` type (`'private' | 'public'`) plus `visibility` and `favoriteCount` fields on `StorageAgentType` / `StorageSkillType` (and their snapshot / create / update / list-input types).
- New list-input options on agents and skills: `entityIds`, `pinFavoritedFor`, `favoritedOnly` — used to enable favorited-first ordering and favorites-only filtering.
- A `StorageSkillFileNode` type for round-tripping the full skill file tree.
- An `InMemoryFavoritesStorage` implementation plus visibility / favorite plumbing on the inmemory and filesystem agent + skill adapters.

All additions are backward compatible at the row level: existing rows without `visibility` or `favoriteCount` continue to work, and the new fields and domain APIs are opt-in.
