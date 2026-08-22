---
'@mastra/server': patch
---

Server adapters can now signal a client-visible error when a stream breaks mid-response, instead of the connection just cutting off. Added `buildStreamErrorFrame` and `buildStreamDoneFrame` to `@mastra/server/server-adapter` for adapters to send a `type: 'error'` frame plus a final `[DONE]` marker when the underlying stream rejects after some data was already sent.
