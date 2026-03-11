---
'@mastra/core': patch
---

Added a `mastra/<version>` User-Agent header to all provider API requests (OpenAI, Anthropic, Google, Mistral, Groq, xAI, DeepSeek, and others) across models.dev, Netlify, and Azure gateways for better traffic attribution.
