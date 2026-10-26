---
'@mastra/core': patch
---

Fixed processors receiving `agent: undefined` in every hook that runs inside the agentic loop. `processInputStep`, `processLLMRequest`, `processLLMResponse`, `processOutputStream`, `processOutputStep`, `processToolResult` and `processOutputResult` now get the running agent as `args.agent`, on regular, durable and evented agents. Previously only `processInput` received it.
