---
'@mastra/libsql': minor
---

Added LibSQL storage support for durable harness sessions.

```ts
const storage = new LibSQLStore({ id: 'mastra-storage', url: 'file:./mastra.db' });

const harness = new Harness({
  ownerId: 'my-app',
  agent,
  memory,
  storage,
  modes: [{ id: 'default', defaultModelId: '__GATEWAY_OPENAI_MODEL__' }],
  defaultModeId: 'default',
});
```
