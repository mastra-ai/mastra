---
'@mastra/core': patch
---

Fixed exponential token growth during multi-step agent workflows by adding `processInputStep` to `TokenLimiterProcessor`. This method runs at every step of the agentic loop (including tool call continuations), pruning the in-memory message list to stay within the token budget before each LLM call. Previously, only `processInput` ran once at the start, so subsequent steps would accumulate unbounded tokens.
