---
'@mastra/sveltekit': minor
---

Added `@mastra/sveltekit`, a server adapter that mounts a Mastra instance in a SvelteKit app through a catch-all `+server.ts` route.

```ts
// src/routes/api/[...path]/+server.ts
import { createSvelteKitRouteHandler } from '@mastra/sveltekit';
import { mastra } from '$lib/server/mastra';

export const { GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD } = createSvelteKitRouteHandler({ mastra });
```
