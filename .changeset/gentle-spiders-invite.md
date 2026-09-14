---
'@mastra/core': minor
---

Added `hookDurationMs` to output stream processor spans. It is the time spent inside `processOutputStream`, summed across all chunks. Fixes https://github.com/mastra-ai/mastra/issues/22343
