---
"@mastra/core": patch
"@mastra/server": patch
"@mastra/express": patch
"@mastra/fastify": patch
"@mastra/hono": patch
"@mastra/koa": patch
"@mastra/nestjs": patch
---

Added Harness v1 remote session mutation APIs and HTTP routes.

Remote clients can now admit message and queued turns with idempotency keys, update session state with state version checks (ETags), switch mode or model, update permissions, respond to pending inbox items, and manage session goals through server routes.

```ts
const admission = await session.admitMessage({
  content: 'Start task',
  admissionId: 'msg-123',
});

await session.setState({ step: 'running' }, { ifVersion: 7 });
```
