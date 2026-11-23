---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed agent signal and message routes accepting a `runId` for a run that belongs to another user. `POST /agents/:agentId/signals`, `/send-message`, `/queue-message` and `/queue-signal` now return 403 when the caller's resource (set by `mapUserToResourceId`) doesn't own the run, so one user can no longer send input into another user's live run. Added `agent.getThreadRunTarget(runId)`, which returns the resource and thread a run is on.

`agent.sendSignal`, `sendMessage`, `queueSignal` and `queueMessage` now throw when a target names both a `runId` and a `resourceId` that doesn't own that run. This is a consistency check, not authorization: Core doesn't know who is calling, and it trusts a target with only a `runId`. If you accept `runId` values from untrusted input, authenticate the caller and check that the run belongs to them before sending:

```ts
const target = agent.getThreadRunTarget(runId);
// callerResourceId must come from your authenticated user, not from the request body.
if (!callerResourceId || !target?.resourceId || target.resourceId !== callerResourceId) {
  throw new Error('Run not found');
}
await agent.sendSignal(signal, { runId });
```
