---
'@mastra/core': minor
---

Added `authorizeSessionResource` to `AgentController`. When auth maps a signed-in user to a resource (`mapUserToResourceId`), that resource normally overrides the session's own, so running a session that owns a different resource fails with "Thread … belongs to resource … but resource … was provided". Return `true` from the hook for callers your app has authorized, and the controller runs that caller with the session's resource in `MASTRA_RESOURCE_ID_KEY`, so memory, caller-supplied tool connections, and cache scoping use the session's resource. Without the hook, nothing changes.

```ts
const controller = new AgentController({
  id: 'app',
  modes,
  authorizeSessionResource: async ({ resourceId, mappedResourceId, requestContext }) =>
    canUseSession({ sessionResourceId: resourceId, callerResourceId: mappedResourceId, requestContext }),
});
```

The decision also governs input sent into a run that is already active. Approved callers join the live run; denied callers are rejected.

Agent sends now reject a caller whose request context carries a `MASTRA_RESOURCE_ID_KEY` that does not match the target thread's resource, before anything is queued, stored or delivered. This covers `sendSignal`, `sendMessage`, `queueMessage`, `sendStateSignal`, `sendNotificationSignal`, `sendToolApproval`, `approveToolCall` and `declineToolCall` (and their `…Generate` variants). On a session, `approveToolCall`, `declineToolCall`, `resumeToolCall`, `respondToToolSuspension` and `respondToPersistedToolApproval` are checked; `respondToToolApproval` is not yet. Only the caller's top-level `requestContext` is checked; `ifIdle.streamOptions.requestContext` is not.

`SendAgentSignalOptions` gains an optional top-level `requestContext`. It applies whether the thread is idle or active, and wins over `ifIdle.streamOptions.requestContext`.

```ts
await agent.sendSignal(signal, { resourceId, threadId, requestContext });
```

`resumeStream`, `resumeGenerate` and `sendStreamResume` do not enforce this check yet; that is a follow-up.
