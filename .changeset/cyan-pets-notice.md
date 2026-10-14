---
'@mastra/core': patch
---

Fixed live assistant messages missing the model that wrote them. Messages streamed by an `AgentController` session now carry `modelId` and `provider` in their metadata, so a client can show the model without reloading the thread. When a fallback model or a later step on another model finishes the reply, `message_end` carries the updated metadata, matching the saved copy.
