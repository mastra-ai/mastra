---
'@mastra/core': minor
---

Added `AgentControllerWireEvent`, `JsonReadyAgentControllerEvent`, `ErrorCarryingAgentControllerEvent` and `WireDisplayState` to `@mastra/core/agent-controller`. They describe an agent controller event as it crosses an HTTP boundary — display-state Maps as records, errors as `{ name, message }`, dates as ISO strings — and are derived from `AgentControllerEvent` itself, so a client can type what it receives without redeclaring the controller's events by hand.
