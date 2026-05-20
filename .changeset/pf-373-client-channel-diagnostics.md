---
'@mastra/client-js': minor
---

Added `RemoteSession.channelDiagnostics()`.

Use `RemoteSession.channelDiagnostics()` to inspect inbox, outbox, action token, and receipt summaries for debugging, monitoring, or auditing a remote Harness session.

```ts
const diagnostics = await session.channelDiagnostics({ limit: 20 });

console.log(diagnostics.inbox.length);
console.log(diagnostics.outbox.length);
```
