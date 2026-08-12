---
'@mastra/core': minor
---

Added support for schema-aware routes created with `createRoute()` in `server.apiRoutes`.

```ts
const route = createRoute({
  method: 'POST',
  path: '/items',
  responseType: 'json',
  bodySchema: z.object({ name: z.string() }),
  handler: async ({ name }) => ({ name }),
})

const mastra = new Mastra({
  server: { apiRoutes: [route] },
})
```
