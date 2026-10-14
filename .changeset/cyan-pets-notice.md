---
'@mastra/core': patch
---

Fixed live assistant messages missing the model that wrote them. Messages streamed by an `AgentController` session now carry `modelId` and `provider` in their metadata, so a client can show the model without reloading the thread. After a fallback, they name the fallback model.
