---
'@mastra/core': patch
---

Fix DurableAgent inference crashes and error reporting (#21138):

- DurableAgent inference no longer crashes with "Cannot read properties of undefined (reading 'type')" on malformed message content.
- Durable LLM errors now keep their original message, name, stack, and cause when reported to callers and `onError`.
