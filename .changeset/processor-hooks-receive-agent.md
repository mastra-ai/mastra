---
'@mastra/core': patch
---

Fixed processor hooks receiving `args.agent` as `undefined` during regular, durable and evented agent runs. Hooks such as `processInputStep`, `processOutputStream` and `processToolResult` now receive the running agent, like `processInput` already did.
