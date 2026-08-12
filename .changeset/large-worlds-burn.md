---
'@mastra/core': minor
---

Fixed an issue where an agent could approve its own suspended tool call and run a consent-gated tool with no human input.

Tools gated by `requireApproval` (on the tool) or `requireToolApproval` (on the agent) could execute without anyone approving them. Three behaviors combined to allow it:

- The `autoResumeSuspendedTools` system prompt told the model to fall back to `approved: true` whenever it could not infer a decision from the user's message.
- The tool execution step accepted `resumeData` that the model wrote into its own tool call arguments as the approval answer.
- Answered suspensions were never marked as resumed, so the auto-resume prompt kept re-arming on every later turn in the thread.

An unrelated follow-up message was enough to make the model re-issue the gated tool call with `resumeData: { approved: true }` and execute it.

**What changed**

Approval decisions are now accepted only from the resume APIs (`approveToolCall()`, `declineToolCall()`, `resumeStream()`). Resume data authored by the model never satisfies an approval gate, so an approval-gated tool the model retries on a later turn suspends again and waits. Answered suspensions are now marked as resumed so the auto-resume directive stops re-arming.

**Before**

```typescript
const stream = await agent.stream('Post this update', { memory });
// suspends for approval

await agent.stream('hm, what happened?', { memory });
// tool executed: the model supplied its own resumeData: { approved: true }
```

**After**

```typescript
const stream = await agent.stream('Post this update', { memory });
// suspends for approval

await agent.stream('hm, what happened?', { memory });
// still suspended, the tool did not run

await agent.approveToolCall({ runId: stream.runId, memory });
// the tool runs only now
```

`autoResumeSuspendedTools` is unchanged for tools that call `suspend()` without an approval gate. Those still resume from the user's next message as before.

Fixes #21303
