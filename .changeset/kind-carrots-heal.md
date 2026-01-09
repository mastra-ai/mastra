---
'@mastra/deployer': minor
---

Serve the Mastra Studio from `studio` folder (previously `playground`).

The function signature for `createNodeServer()` changed, `playground` was renamed to `studio`:

```ts
await createNodeServer(mastra, { studio: true, swaggerUI: false, tools: {} });
```
