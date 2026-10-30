---
'@mastra/core': minor
---

Suspended background tool calls can now be answered after a reload.

**Open request saved on the tool call.** While a deferred background tool is suspended, the assistant message that holds the call keeps the open request in `metadata.suspendedTools[toolCallId]` (with `suspendPayload`, `taskId`, and `suspendedAt`). The entry is removed when the task resumes or is cancelled, so a chat that reloads the thread shows only requests that are still open.

**Resumed tools see what they asked for.** A resumed background tool now receives the payload it suspended with in `context.agent.suspendPayload`, the same as a foreground tool:

```typescript
execute: async (input, context) => {
  const { resumeData, suspendPayload, suspend } = context.agent;
  if (!resumeData) return suspend?.({ question: 'Approve the refund?' });
  // suspendPayload is { question: 'Approve the refund?' }
};
```

**Resume only the suspension you read.** `BackgroundTaskManager.resume()` takes an optional `suspendedAt`, and refuses the resume when the task has resumed or suspended again since:

```typescript
await mastra.backgroundTaskManager.resume(taskId, { approved: true }, { suspendedAt: task.suspendedAt });
```

**The agent reports a deferred task's result after its stream ends.** When a deferred background task finishes and no `untilIdle` stream is open for its thread, the agent now gets a `background-task` notification signal on the thread. An idle thread wakes and the agent reports the outcome; a run already active on the thread gets the signal on its next model request. Before, the result was only written to memory and waited for the next user message. This covers `stream()` calls without `untilIdle` and tasks resumed after they suspended, for example an MCP task answered from the chat. Streams using `untilIdle` are unchanged: they still run their own follow-up turn, and no signal is sent. Cancelling or aborting an `untilIdle` stream still means no reply for the tasks it was waiting for.

**A run woken by a signal no longer waits for its background tasks.** A run that a signal starts on an idle thread used to run with `untilIdle` on, so it stayed open until every task it dispatched finished. It now ends after its own turn, and each task wakes the thread when it finishes. Pass `untilIdle: true` in `ifIdle.streamOptions` to keep the old behavior. Channels and agent controller sessions pass it, so channel replies and session runs still wait for background tasks.

**Turn off the completion signal.** Set `notifyAgentOnFinish: false` in the `backgroundTasks` config when your app sends its own completion signal, for example from `onTaskComplete`.
