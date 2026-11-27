---
'@mastra/core': patch
---

Fixed durable agents offering the wrong tools after a resume by a different caller. When a run paused for approval is resumed with a different request context, the steps after the approval now get the tools built for the resuming caller, on the same server, on another server or worker, and after crash recovery. Previously they could keep tools built for the caller who started the run.

Call-time `toolsets` from the starting call are no longer carried into later steps, matching a regular `Agent` resume. To keep them, pass them again on the resume.

Before: a resume kept the starting call's `toolsets`.

```ts
const stream = await agent.stream('Clean up the records', { toolsets: { admin: adminTools } });
// ...
await agent.approveToolCall({ runId: stream.runId, toolCallId });
```

After: pass them again on the resume.

```ts
await agent.approveToolCall({ runId: stream.runId, toolCallId, toolsets: { admin: adminTools } });
```
