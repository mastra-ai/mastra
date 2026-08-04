---
'@mastra/server': minor
---

Added A2A v0.3 human-in-the-loop task handling. Exposed agents now pause with an input-required status and resume the same run when clients send follow-up input.

```typescript
const result = await remoteAgent.resumeGenerate({ approved: true }, { runId });
```

The server also preserves terminal task states and handles authentication interruptions, resubscription, cancellation errors, unknown task IDs, and JSON-RPC request ID zero.
