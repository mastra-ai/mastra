---
'@mastra/server': patch
---

Fixed server startup readiness: routes now wait for Harness and channel readiness before accepting traffic.

```ts
const server = new MastraServer({ app, mastra });
await server.init();
```
