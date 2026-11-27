---
'@mastra/libsql': patch
---

Fixed importing @mastra/libsql with an injected client when native libsql bindings are unavailable. Native bindings now load only for URL-based connections. Fixes https://github.com/mastra-ai/mastra/issues/28201.
