---
'@mastra/convex': minor
---

Added shared channel state storage, so message deduplication and interactive elements work across multiple Mastra instances.

Convex schemas are owned by your app, so this one needs a manual step. Add the new table to your `convex/schema.ts` and redeploy:

```ts
import { mastraChannelStateTable } from '@mastra/convex/server';

export default defineSchema({
  // ...existing Mastra tables
  mastra_channel_state: mastraChannelStateTable,
});
```

```bash
npx convex deploy
```

Channel operations fail with a clear Convex error until the table exists.
