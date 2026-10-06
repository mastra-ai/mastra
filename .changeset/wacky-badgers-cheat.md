---
'@mastra/core': patch
---

Fixed two restart problems on durable runs.

**Recovering a suspended durable agent run** now fails immediately with a clear message pointing at `resume()`. Previously it resolved, then emitted a lone "This workflow run was not active" error. Continue a run that is suspended on a tool call or an approval with `resume(runId, ...)`.

**Restarting an evented workflow in a process that has not started its workers** now starts them before the restart is published. Previously the restart was published to no one, so the run stalled forever with no error, and starting the workers later could not revive it. This does not change instances configured with `workers: false` (or `MASTRA_WORKERS=false`). Those still publish the restart to the broker, so the run completes only if another worker consumes it.
