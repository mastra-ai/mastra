---
'@mastra/schema-compat': patch
---

Fixed tool schemas for Azure OpenAI models created with `@ai-sdk/azure`. These models report providers like `azure.responses` and `azure.chat`, so they previously skipped the OpenAI schema compat layers. As a result, GPT models filled optional tool inputs with made-up values. Optional fields are now sent as nullable, the same as with `@ai-sdk/openai`. Claude, DeepSeek and Meta models served through Azure still use their own compat layers.
