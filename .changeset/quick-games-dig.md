---
'@mastra/core': minor
'@mastra/libsql': patch
---

Expanded `Session.getDisplayState()` shape so TUIs and dashboards can render the full session at a glance from a single snapshot.

**What's new**

- Run fields: `isRunning`, `currentRunId`, `currentMessageId`, `currentTraceId`.
- Activity fields: `activeTools`, `toolInputBuffers`, `activeSubagents` (fresh per call).
- Token usage accumulates across turns on `tokenUsage`.
- Interrupts now surface as the full `pending: PendingResume | null` payload instead of four separate booleans.

```ts
const ds = session.getDisplayState();
if (ds.isRunning) showSpinner(ds.currentRunId);
if (ds.pending?.kind === 'question') promptUser(ds.pending.payload);
console.log(ds.tokenUsage.totalTokens);
```
