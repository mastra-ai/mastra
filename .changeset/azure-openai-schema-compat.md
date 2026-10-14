---
'@mastra/schema-compat': patch
---

Fixed Azure OpenAI GPT models filling optional tool inputs with made-up values. They now leave optional inputs empty, as they already do through `@ai-sdk/openai`. This applies when the Azure deployment name contains an OpenAI model name, such as `gpt-4o`, `my-gpt5-deployment` or `o3-mini`. Deployments with other names, such as `production`, and non-OpenAI models served through Azure behave as before.
