---
'@mastra/convex': minor
---

Added `ConvexServerCache` so Convex-backed Mastra apps can keep durable stream replay and response cache state in Convex.

```ts
import { ConvexServerCache } from '@mastra/convex';

const cache = new ConvexServerCache({
  deploymentUrl: process.env.CONVEX_URL!,
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
});
```

The package also exports the Convex cache schema tables and server mutation for mounting the cache handler in a Convex app.
Existing Convex users who adopt the cache must add `mastra_cache` and `mastra_cache_list_items` to their Convex schema, mount the `mastraCache` handler, and deploy the schema update.
