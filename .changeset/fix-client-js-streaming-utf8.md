---
'@mastra/client-js': patch
---

Fixed streamed UTF-8 characters being corrupted when their bytes span network chunks.
