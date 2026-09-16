---
'@mastra/core': patch
---

Fix `EventedAgent.executeWorkflow()` emitting a run's terminal error from an un-awaited `.catch`, which could surface as an `unhandledRejection` during shutdown. Both terminal-error emission sites now route through `emitErrorInBackground()`, so a publish failure (e.g. pubsub/storage closed while the run finishes) is logged as a warning instead of crashing the process — matching the `DurableAgent` behavior fixed in #23168.
