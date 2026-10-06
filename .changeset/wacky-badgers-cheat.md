---
'@mastra/core': patch
---

Fixed two restart problems on durable runs.

**Recovering a suspended durable agent run** now fails immediately with a clear message pointing at `resume()`, instead of resolving and later emitting a lone "This workflow run was not active" error. A run suspended on a tool call or an approval is continued with `resume(runId, ...)`.

**Restarting an evented workflow in a process that has not started its workers** now starts them and completes the run. Previously the restart was published to no one and the run stalled forever with no error, and starting the workers later could not revive it. This does not change instances configured with `workers: false` (or `MASTRA_WORKERS=false`), which stay a deliberate wait.
