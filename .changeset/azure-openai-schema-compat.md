---
'@mastra/schema-compat': patch
---

Fixed Azure OpenAI GPT models filling optional tool inputs with made-up values. They now leave optional inputs empty, as they already do through `@ai-sdk/openai`. Claude, DeepSeek, Llama (including CodeLlama), Mistral (including Codestral, Ministral and Mixtral), Phi, Grok and Cohere models served through Azure, and models created with `azure.deepseek()`, behave as before.
