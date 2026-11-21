---
'@mastra/client-js': patch
---

Streams stop their request when your chunk handler throws.

If the `onChunk` callback you pass to `response.processDataStream({ onChunk })` threw, the client stopped reading but left the response open, so the server kept generating a reply nobody would receive. The client now stops the request when the handler fails, and your original error still surfaces. Fixes #30788.
