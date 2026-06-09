---
'@mastra/libsql': minor
---

Added LibSQL storage support for durable harness sessions.

```ts
const storage = new LibSQLStore({ id: 'app', url: 'file:./mastra.db' });
const harnessStore = await storage.getStore('harness');

await harnessStore?.saveSession(sessionRecord);
const session = await harnessStore?.loadSession(sessionId);
```
