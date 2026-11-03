---
"@mastra/core": patch
---

Models selected with a `provider/model` string for OpenAI, Anthropic, Google, OpenRouter, OpenAI-compatible providers and gateways now run on AI SDK v7 provider packages. Mistral and Perplexity models are unchanged.

**Gemini schemas**: for models like `google/gemini-3.8-flash`, tool input schemas and structured output schemas now reach Gemini as standard JSON Schema (`parametersJsonSchema` and `responseJsonSchema`) instead of being converted to Gemini's OpenAPI schema subset first.
