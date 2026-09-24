---
'@mastra/core': patch
---

Fixed `TokenLimiterProcessor` counting history that later prompt processors remove from the request. In the default `best-fit` and `contiguous` trim modes, the input budget is now enforced on the provider prompt in `processLLMRequest`, after earlier prompt processors such as `ToolCallFilter` have run, so only tokens that reach the model are counted. Tool calls and their results are kept or removed together, and stored messages are no longer changed.

Where `processLLMRequest` doesn't run, such as `generateLegacy()`, `streamLegacy()` and limiters inside a processor workflow, `processInputStep` still trims stored messages as before.
