---
'@mastra/client-js': patch
---

Parse SSE responses line by line so frames that carry `id:`, `event:`, `retry:`, or comment lines alongside their `data:` lines are no longer silently dropped. Previously a frame was only read when it began with `data:`, so a proxy or adapter that added any other SSE field caused the whole chunk to be discarded.
