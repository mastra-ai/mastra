---
'@mastra/inngest': minor
---

Added `createServe` factory function to support multiple web framework adapters for Inngest workflows.

Previously, the `serve` function only supported Hono. Now you can use any framework adapter provided by the Inngest package (Express, Fastify, Koa, Next.js, and more).

**Before (Hono only)**

```typescript
import { serve } from '@mastra/inngest';

// Only worked with Hono
app.all('/api/inngest', c => serve({ mastra, inngest })(c));
```

**After (any framework)**

```typescript
import { createServe } from '@mastra/inngest';
import { serve as expressAdapter } from 'inngest/express';
import { serve as fastifyAdapter } from 'inngest/fastify';

// Express
app.use('/api/inngest', createServe(expressAdapter)({ mastra, inngest }));

// Fastify
fastify.route({
  method: ['GET', 'POST', 'PUT'],
  url: '/api/inngest',
  handler: createServe(fastifyAdapter)({ mastra, inngest }),
});
```

The existing `serve` export remains available for backward compatibility with Hono.

Fixes #10053
