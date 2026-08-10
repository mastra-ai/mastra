---
'@mastra/express': minor
---

Added support for `createRoute()` routes configured through `server.apiRoutes`.

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
