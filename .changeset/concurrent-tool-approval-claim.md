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

Durable agents report the losing resume the same way, as an error chunk in its stream with the `AGENT_RESUME_ALREADY_CLAIMED` id.

What each resume error means:

- `AGENT_RESUME_ALREADY_CLAIMED`: another approval or resume of this run is running or just finished. Stop retrying.
- `AGENT_RESUME_RUN_NOT_SUSPENDED` (durable agents): the run exists but isn't waiting for approval, for example because it already finished or failed. `details.status` gives its state.
- `AGENT_RESUME_NO_SNAPSHOT_FOUND`: there is no record of a suspended run. Check the `runId`. Agents delete a run's record when it finishes, so an approval sent after that also gets this error.

Resuming a workflow run that isn't suspended now throws an error with the id `WORKFLOW_RUN_NOT_SUSPENDED`. The message is unchanged.

Storage adapters that support atomic updates (for example PostgreSQL, LibSQL, MongoDB, and the in-memory store) protect against duplicates across processes. Other adapters protect against duplicates within a single process.
