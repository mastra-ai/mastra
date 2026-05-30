---
'@mastra/core': minor
'@mastra/deployer': patch
---

Added `validators` option to `registerApiRoute` for automatic request validation using any [Standard Schema](https://standardschema.dev/)-compatible library (Zod, Valibot, ArkType, etc.). When validators are provided for a target (`json`, `query`, `param`, `header`, or `form`), the server validates the corresponding part of the request before calling the handler and returns a structured 400 response on failure.

**Example:**
```ts
import { z } from 'zod';
import { registerApiRoute } from '@mastra/core/server';

registerApiRoute('/items', {
  method: 'POST',
  validators: {
    json: z.object({ name: z.string(), price: z.number() }),
    query: z.object({ currency: z.string().optional() }),
  },
  handler: async (c) => {
    const body = c.req.valid('json');    // validated + typed
    const query = c.req.valid('query'); // validated + typed
    return c.json({ id: 1, ...body });
  },
});
```
