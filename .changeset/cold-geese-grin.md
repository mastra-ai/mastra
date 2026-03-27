---
'@mastra/core': patch
---

Fixed title generation blocking stream completion. The `generateTitle` LLM call now runs in the background instead of blocking the stream from closing, removing the 2-3 second post-response delay in the UI when memory is enabled.
