---
'@mastra/core': patch
---

Fixed live assistant messages missing the model that wrote them. Messages streamed by an `AgentController` session now carry `modelId` and `provider` in their metadata from the first event, the same values their saved copy has, so a client can show the model without reloading the thread. The `step-start` stream chunk now includes `modelId` and `provider` in its payload on every engine.
