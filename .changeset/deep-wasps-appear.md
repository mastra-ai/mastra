---
'@mastra/core': patch
---

Fixed exponential token growth during multi-step agent workflows by implementing `processInputStep` on `TokenLimiterProcessor` and removing the redundant `processInput` method. Token-based message pruning now runs at every step of the agentic loop (including tool call continuations), keeping the in-memory message list within budget before each LLM call. Also refactored Tiktoken encoder to use the shared global singleton from `getTiktoken()` instead of creating a new instance per processor.
