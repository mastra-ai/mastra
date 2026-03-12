---
'@mastra/core': patch
---

Fixed a bug where thread metadata (e.g. title, custom properties) passed via `options.memory.thread` was discarded when `MASTRA_THREAD_ID_KEY` was set in the request context. The thread ID from context still takes precedence, but all other user-provided thread properties are now preserved.
