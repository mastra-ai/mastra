---
'@mastra/client-js': minor
---

Added typed client-side resources for the stored-entity HTTP surface so you no longer have to hand-roll `fetch` calls.

```ts
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: 'http://localhost:4111' });

// List/get with favorite metadata
const { items } = await client.storedAgents.list({ page: 1, perPage: 20 });
const agent = await client.storedAgents.get(items[0].id);
console.log(agent.favoriteCount, agent.isFavorited);

// Favorite toggle
await client.storedAgents.favorite(agent.id);
await client.storedAgents.unfavorite(agent.id);

// Versioning + publish
const draft = await client.storedSkills.create({ /* ... */ });
const published = await client.storedSkills.publish(draft.id);
await client.storedSkills.restore(draft.id, { version: 1 });
```

Also regenerated `route-types.generated.ts` to cover the new editor-builder introspection routes (`/editor/builder/settings`, `/editor/builder/infrastructure`) and the external skill-registry endpoints under `/editor/builder/registries` (list, search, popular, preview, install).
