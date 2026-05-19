---
'@mastra/editor': minor
---

Added an `editor.favorites` namespace so direct (non-HTTP) callers can favorite, unfavorite, and query favorited stored agents/skills through the editor instance.

```ts
import { MastraEditor } from '@mastra/editor';

const editor = new MastraEditor({ mastra });

// Toggle
await editor.favorites.favorite({ userId, entityType: 'agent', entityId });
await editor.favorites.unfavorite({ userId, entityType: 'agent', entityId });

// Lookups
const isFav = await editor.favorites.isFavorited({ userId, entityType: 'agent', entityId });
const favSet = await editor.favorites.isFavoritedBatch({ userId, entityType: 'agent', entityIds });
const ids = await editor.favorites.listFavoritedIds({ userId, entityType: 'agent' });
```

The namespace performs the storage mutation only — visibility and ownership enforcement still belong to the caller (the HTTP route handlers in `@mastra/server` already do this).
