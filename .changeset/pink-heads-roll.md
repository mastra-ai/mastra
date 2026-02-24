---
'@mastra/core': patch
---

Fixed abortSignal not stopping LLM generation or preventing memory persistence. When aborting a stream (e.g., client disconnect), the LLM response no longer continues processing in the background and partial/full responses are no longer saved to memory. Fixes #13117.
