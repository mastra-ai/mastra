---
'@mastra/core': patch
---

Fixed a call that passes `hooks: { beforeToolCall: null }` (for example from a JSON request body) turning off the agent's own tool hooks. Non-function values in call-time `hooks` are now ignored, so constructor hooks and `defaultOptions.hooks` still run.
