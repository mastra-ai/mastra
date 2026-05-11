---
'@mastra/core': patch
---

Fixed workflow resume to reuse suspended step input payloads when previous step output is stale. Fixes https://github.com/mastra-ai/mastra/issues/16051.
