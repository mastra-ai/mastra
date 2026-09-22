---
'@mastra/core': patch
---

Fixed `TokenLimiterProcessor` measuring history that later prompt processors remove from the request. In the default `best-fit` and `contiguous` trim modes the input budget is now enforced on the provider prompt in `processLLMRequest`, after earlier prompt processors such as `ToolCallFilter` have run, so only the tokens that actually reach the model are counted. Tool call and tool result messages are trimmed together, and stored messages are no longer mutated on the prompt-stage path.

On the prompt-stage path `processInputStep` skips standard trimming and defers to `processLLMRequest`. For legacy and workflow-nested paths that do not invoke `processLLMRequest`, `processInputStep` still trims stored messages to keep history bounded — this preserves the existing contract for `generateLegacy`, `streamLegacy`, and limiters wrapped in `createStep`.
