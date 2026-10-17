---
'@mastra/core': patch
---

`@mastra/core/channels` now exports `CHAT_CHANNEL_RENDER_CONTEXT_KEY` and the `ChatChannelRenderContext` type, so tools resolved per request can reach the live chat thread a run is replying in (for example, to upload a file into it).
