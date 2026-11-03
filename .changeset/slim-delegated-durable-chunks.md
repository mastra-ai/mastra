---
'@mastra/core': patch
---

Fixed durable agent run streams storing a sub-agent's full prompt, message history and steps on every chunk it forwards during delegation. These copies are now removed before the chunk is published, so the replay cache no longer grows by megabytes per delegated run. Top-level chunks and data written by tools are published unchanged, and the sub-agent's usage is still reported.
