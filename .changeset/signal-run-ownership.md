---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed agent signal and message routes accepting a `runId` for a run that belongs to another user. `POST /agents/:agentId/signals`, `/send-message`, `/queue-message` and `/queue-signal` now return 403 when the caller's resource (set by `mapUserToResourceId`) doesn't own the run, so one user can no longer send input into another user's live run. Added `agent.getThreadRunTarget(runId)`, which returns the resource and thread a run is on.

`agent.sendSignal`, `sendMessage`, `queueSignal` and `queueMessage` now throw when a target names both a `runId` and a `resourceId` that doesn't own that run. Core doesn't know who is calling, so a target with only a `runId` is still trusted: if you pass `runId` values from untrusted input, pass the caller's `resourceId` too, or check ownership first:

```ts
const target = agent.getThreadRunTarget(runId);
if (!target || target.resourceId !== callerResourceId) {
  throw new Error('Run not found');
}
await agent.sendSignal(signal, { runId });
```
