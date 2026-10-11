---
'@mastra/core': patch
---

Fixed a tool running twice when the same suspended tool call is approved, declined, or resumed concurrently (for example a double click, a client retry, or two open tabs). `approveToolCall`, `declineToolCall`, `resumeStream`, and their generate variants now claim the suspended run before resuming it. Only one caller resumes; the others fail with `AGENT_RESUME_ALREADY_CLAIMED`.

```ts
const results = await Promise.allSettled([
  agent.approveToolCall({ runId, toolCallId }),
  agent.approveToolCall({ runId, toolCallId }),
]);
// One fulfilled, one rejected with AGENT_RESUME_ALREADY_CLAIMED. The tool runs once.
```

Storage adapters that support atomic updates (for example PostgreSQL, LibSQL, MongoDB, and the in-memory store) protect against duplicates across processes. Other adapters protect against duplicates within a single process.
