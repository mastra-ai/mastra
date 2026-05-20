---
'@mastra/core': minor
---

Added read-only Harness channel diagnostics for local sessions.

Use `Harness.getChannelDiagnostics()` or `Harness.channels.diagnostics()` to inspect message flow and troubleshoot Harness sessions. The result includes inbox, outbox, action token, and action receipt summaries for a session and its child sessions.

```ts
const diagnostics = await harness.getChannelDiagnostics(sessionId, { limit: 25 });

console.log(`Inbox items: ${diagnostics.inbox.length}`);
console.log(`Outbox items: ${diagnostics.outbox.length}`);
```

Storage adapters can optionally implement `listChannelDiagnosticsRows()` to surface ledger rows without side effects.
