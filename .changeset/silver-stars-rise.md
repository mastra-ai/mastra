---
'@mastra/core': minor
---

Added a favorites storage domain that lets users mark stored agents and skills as favorites, plus `visibility` (`'private' | 'public'`) and `favoriteCount` fields on stored agents and skills so callers can list, filter, and order by favorite state.

Existing rows without `visibility` or `favoriteCount` continue to work; the new fields and APIs are opt-in.

**Example**

```ts
const favorites = await storage.getStore('favorites');

await favorites?.favorite({ userId: 'u1', entityType: 'agent', entityId: 'agent-123' });

const favoritedIds = await favorites?.listFavoritedIds({ userId: 'u1', entityType: 'agent' });

// List agents the user has favorited, surfaced first
const { agents } = await storage.getStore('agents').list({
  pinFavoritedFor: 'u1',
  favoritedOnly: true,
});
```
