---
'@mastra/core': patch
---

Fix `ChatChannelProcessor` clobbering tagged system messages from other processors (e.g. observational memory). The channel processor now adds its system message directly to the message list under the `chat-channel-context` tag instead of returning a flattened `systemMessages` array, so it no longer triggers the runner's `replaceAllSystemMessages` path that strips other processors' tags.
