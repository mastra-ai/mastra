---
'@mastra/client-js': patch
'mastra': patch
---

Added Harness session list and create API support to the JS client route types and CLI API metadata.

```ts
const sessions = await client.request('GET /harness/:name/sessions', {
  params: { name: 'code' },
  query: { limit: 25 },
});
```
