---
'@mastra/core': patch
---

Fix DurableAgent inference crashes with "Cannot read properties of undefined (reading 'type')" (#21138). Prompt conversion now skips undefined holes in message content arrays and backfills a valid `{ type: 'json', value: null }` output for tool-result parts missing an output, so malformed messages produced by upstream rewrites can no longer crash provider converters. Error chunks emitted by durable LLM execution now serialize the message, name, and stack explicitly, and consumers preserve the producer's stack and cause when re-throwing, keeping crashes attributable to their real throw site.
