---
'@mastra/core': patch
---

Fixed durable agent streams crashing when consumed by `@mastra/ai-sdk` and other chunk converters. The `step-start` stream chunks now use the canonical shape, matching the regular engine and preventing destructuring errors when reading the chunk payload.
