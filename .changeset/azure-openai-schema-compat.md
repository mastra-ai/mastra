---
'@mastra/schema-compat': patch
---

Fixed Azure OpenAI GPT models filling optional tool inputs with made-up values. They now leave optional inputs empty, as they already do through `@ai-sdk/openai`. Claude, DeepSeek, Llama, Mistral, Phi, Grok and Cohere models served through Azure behave as before.
