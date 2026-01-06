---
'@mastra/core': patch
---

Fix reasoning providerMetadata leaking into text parts when using memory with OpenAI reasoning models. The runState.providerOptions is now cleared after reasoning-end to prevent text parts from inheriting the reasoning's itemId.

