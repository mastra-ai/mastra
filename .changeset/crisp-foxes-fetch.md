---
'@mastra/platform-workspace': patch
'@mastra/factory': patch
'@mastra/core': patch
---

Added an `awaitAcceptance` option to agent-controller session signals. When set, `session.sendSignal` waits for the agent to accept the wake signal and rejects if delivery fails, instead of resolving optimistically. This lets callers that need guaranteed delivery (like the Factory rule dispatcher) detect and retry failed kickoffs.
