---
'@mastra/client-js': patch
---

Fixed streamed responses staying open after your `onChunk` handler throws. `processDataStream({ onChunk })` now closes the request when the handler fails, so the server stops sending a reply nobody will read. Your original error still reaches you. Fixes #30788.
