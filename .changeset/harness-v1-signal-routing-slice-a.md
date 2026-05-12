---
'@mastra/core': patch
---

Route harness v1 `Session.message()` through `agent.sendSignal()` so user messages on an idle thread start a fresh run via the same signal-driven path the agent layer (and MastraCode) already use end-to-end. The structured + `sync: true` path still calls `agent.generate()` directly. Adds `Agent.getRunOutput(runId)` so signal-routed callers can resolve the `MastraModelOutput` for a registered run.
