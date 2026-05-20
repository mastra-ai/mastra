---
'@mastra/libsql': minor
---

LibSQL storage now supports Harness channel diagnostics.

Developers using LibSQL can run read-only channel diagnostics queries for troubleshooting Harness session message flow.

```ts
const diagnostics = await harness.getChannelDiagnostics(sessionId, { limit: 25 });

console.log(diagnostics.outbox.length);
```
