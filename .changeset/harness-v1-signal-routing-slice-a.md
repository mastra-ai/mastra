---
'@mastra/core': patch
---

Improved Harness v1 `Session.message()` routing for idle threads.

- User messages on idle threads now start agent runs through `agent.sendSignal()`, matching the signal-driven path used by the agent layer and MastraCode.
- Structured synchronous calls still use `agent.generate()` directly.
- `Agent.getRunOutput(runId)` lets signal-routed callers resolve the registered `MastraModelOutput`.
