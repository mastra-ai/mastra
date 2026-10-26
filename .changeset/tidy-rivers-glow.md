---
'@mastra/core': patch
---

Fixed trace scoring for agent scorers: tool calls that start in the same millisecond (parallel tool calls) now keep their original order, and tools executed by the model provider (for example Anthropic web search) are now included in the scorer's tool invocations, matching what live scoring sees.
