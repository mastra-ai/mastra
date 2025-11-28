---
'@mastra/core': patch
---

Fix GPT-5/o3 reasoning models failing with "required reasoning item" errors when using memory with tools. Empty reasoning is now stored with providerMetadata to preserve OpenAI's item_reference.
