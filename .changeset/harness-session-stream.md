---
'@mastra/core': patch
'mastracode': patch
---

Move the Harness's live agent thread subscription onto the Session as `session.stream` (a new `SessionStream` class).

`SessionStream` owns the subscription handle and its dedup key plus the mechanical lifecycle — reuse check (`matches`), adopt (`attach`), teardown (`cleanup`/`detach`), identity check (`isCurrent`), and active-run-id read (`activeRunId`). The Harness still produces the subscription (calling the agent) and consumes its stream; it now delegates handle/key bookkeeping to the session. The verbose `agentThreadSubscription`/`agentThreadSubscriptionKey` fields and the `isActiveAgentThreadSubscription` helper are gone.

With the subscription now session-owned, two accessors that compose it relocate onto the Session:

- `Session.getCurrentRunId()` — the active run id, preferring the live subscription's run id and falling back to the run tracker. `Harness.getCurrentRunId()` is removed; read `harness.session.getCurrentRunId()`.
- `Session.abortRun()` — abort the live subscription's run and mark the run as aborting. `Harness.abort()` delegates the run-abort to `session.abortRun()`.

`Harness.abort()` and `Harness.isCurrentThreadStreamActive()` remain on the public API with unchanged behavior. Mastracode reads of `getCurrentRunId()` are repointed at `harness.session.getCurrentRunId()`.
