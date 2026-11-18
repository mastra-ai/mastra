---
'@mastra/client-js': patch
---

Streams stop reading at the server when your chunk handler throws.

If the `onChunk` callback passed to `agent.stream()` or `network()` threw, the client stopped reading but left the response open, so the server kept generating a reply nobody would receive. The client now cancels the response when the handler fails, and your original error still surfaces. Fixes #30788.
