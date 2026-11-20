---
'@mastra/core': patch
---

Durable agent runs that pause for approval and are then resumed now close their PubSub subscriptions as soon as the run finishes. Fixes [#30479](https://github.com/mastra-ai/mastra/issues/30479).

Before this fix, a resumed run kept its stream readers and its abort listener until `cleanupTimeoutMs`. This affected runs resumed with `sendStreamResume()`, `resume()` or `approveToolCall()`. On `@mastra/redis-streams` each of these subscriptions holds its own Redis connection. If you raised `cleanupTimeoutMs` to keep `observe()` replay available longer, those connections also stayed open longer. Runs that were never paused already closed theirs right away.

- **Subscriptions close when the run ends.** A stream reader unsubscribes once it has handled the run's end (finish, error or abort). A paused run keeps its subscriptions so the approval still works.
- **Run state still waits for `cleanupTimeoutMs`.** The run's event history and run record are kept until `cleanupTimeoutMs`, as before. `observe()` can still replay a finished run during that window.
- **Behavior change.** Aborting a durable run that has already finished now reports that nothing was stopped (`false`), the same as for a plain run. Before this fix it could report `true` during the `cleanupTimeoutMs` window even though there was nothing left to stop.
