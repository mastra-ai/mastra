---
'@mastra/core': patch
---

Fixed live assistant messages missing the model that wrote them. Messages streamed by an `AgentController` session now carry `modelId` and `provider` in their metadata, so a client can show the model without reloading the thread. `message_end` now carries the message's final metadata, so a client also sees the model that finished the reply after a fallback or a mid-reply model switch, plus the final `stopReason`.
