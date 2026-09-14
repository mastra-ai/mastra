---
'@mastra/core': minor
---

Added a `hookDurationMs` attribute to output stream processor spans. It records the time spent inside `processOutputStream` across all chunks, so you can tell a slow processor from a slow model. The span's own duration still covers the whole stream. Fixes https://github.com/mastra-ai/mastra/issues/22343
