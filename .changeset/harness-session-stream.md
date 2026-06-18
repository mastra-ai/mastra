---
'@mastra/core': patch
---

Move the Harness's live agent thread subscription onto the Session as `session.stream` (a new `SessionStream` class).

`SessionStream` owns the subscription handle and its dedup key plus the mechanical lifecycle — reuse check (`matches`), adopt (`attach`), teardown (`cleanup`/`detach`), identity check (`isCurrent`), and active-run-id read (`activeRunId`). The Harness still produces the subscription (calling the agent) and consumes its stream; it now delegates handle/key bookkeeping to the session. The verbose `agentThreadSubscription`/`agentThreadSubscriptionKey` fields and the `isActiveAgentThreadSubscription` helper are gone.

Harness public API is unchanged: `abort()`, `getCurrentRunId()`, and `isCurrentThreadStreamActive()` keep their behavior (they now read through `session.stream` internally). No consumer changes required.
