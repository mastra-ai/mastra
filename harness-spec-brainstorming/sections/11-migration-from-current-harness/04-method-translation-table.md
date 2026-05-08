### 11.4 Method translation table

The table below maps each method on the legacy `Harness` to its new `Harness` + `Session` equivalent (i.e. the `@mastra/core/harness/v1` API).

| Legacy `Harness` (`@mastra/core/harness`) | v1 `Harness` + `Session` (`@mastra/core/harness/v1`) |
|---|---|
| `harness.sendMessage(...)` | `session.message(...)` (default — always accepted, signal-driven). Use `session.queue(...)` only for sequential standalone turns. |
| `harness.getCurrentThreadId()` | `session.threadId` |
| `harness.switchThread({ threadId })` | `harness.session({ threadId, resourceId })` |
| `harness.switchMode({ modeId })` | `session.switchMode({ mode })` |
| `harness.switchModel({ modelId })` | `session.switchModel({ model })` |
| `harness.subscribe(listener)` | `session.subscribe(listener)` (or `harness.subscribe` for cross-session) |
| `harness.getDisplayState()` | `session.getDisplayState()` |
| `harness.abort()` | *removed* — cancellation is not a session concern in v1. With agent signals, messaging and stopping are orthogonal. Clients that want a "STOP" affordance call `agent.abort(...)` (or whatever surface owns the run loop) and then `session.message(...)` for new content. |
| `harness.steer(...)` | *removed* — `session.message(...)` already drains into the live run via signals. The "abort + redirect" semantic is no longer needed; if a caller really wants to abort first, that's a separate agent-layer concern (see `harness.abort()` row). |
| `harness.followUp(...)` | `session.message(...)` (default) or `session.queue(...)` (sequential turns). |
| `harness.isRunning()` | `session.isBusy()` |
| `harness.memory.createThread(...)` | `harness.threads.create(...)` |
| `harness.cloneThread(...)` | `harness.threads.clone(...)` |
| `harness.listThreads(...)` | `harness.threads.list(...)` |
| `harness.renameThread({ title })` | `harness.threads.rename(threadId, title)` |
| `harness.grantSessionTool(...)` | `session.permissions.grantTool(...)` |
| `harness.setPermissionForCategory(...)` | `session.permissions.setPolicy({ category, policy })` |
| `harness.setPermissionForTool(...)` | `session.permissions.setPolicy({ toolName, policy })` |
| `harness.getObservationalMemoryRecord()` | `session.om.getRecord()` |
| `harness.switchObserverModel(...)` | `session.om.switchObserverModel(...)` |
| `harness.registerHeartbeat(...)` | `harness.onInterval(...)` (returns unsubscribe) |
| `harness.removeHeartbeat({ id })` | call the unsubscribe function returned by `onInterval` |
| `harness.getModelName()` | *removed* — `session.getCurrentModelId().split('/').pop()` |
| `harness.getFullModelId()` | *removed* — duplicate of `getCurrentModelId()` |
| `harness.getResolvedObserverModel()` | *removed* — trivial composition |
| `harness.getSession()` | *removed* — name collides with new `Session` |
| `harness.selectOrCreateThread()` | *removed* — use `harness.session({ resourceId })` |
| `harness.setResourceId(...)` | *removed* — set at session creation |
