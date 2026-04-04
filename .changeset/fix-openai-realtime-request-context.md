---
'@mastra/voice-openai-realtime': patch
---

Fix requestContext not being propagated to tool executions in voice/STS mode. The requestContext passed to `voice.connect({ requestContext })` was incorrectly placed in the first argument (tool input) instead of the second argument (execution context) when calling `tool.execute()`, causing tools to receive an empty RequestContext.
