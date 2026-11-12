---
'@mastra/core': patch
---

Fixed the replay cache of DurableAgent and EventedAgent runs storing a sub-agent's full prompt, message history and steps on every chunk it forwards during delegation. The cached copy of these chunks now leaves them out, so the cache no longer grows by megabytes per delegated run. Callers streaming their own run still receive the full chunks, top-level chunks and data written by tools are cached unchanged, and the sub-agent's usage is still reported.
