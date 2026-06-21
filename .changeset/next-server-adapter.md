---
'@mastra/next': minor
---

Added `@mastra/next` — a server adapter for Next.js App Router. Drop your Mastra instance into a catch-all route to expose all Mastra API endpoints without manually wiring routes.

**Usage**

```ts
// app/api/[...mastra]/route.ts
import { createNextRouteHandler } from '@mastra/next';
import { mastra } from '../../../mastra';

export const { GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD } = createNextRouteHandler({ mastra });
```
