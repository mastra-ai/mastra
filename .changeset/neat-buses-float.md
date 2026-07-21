---
'@mastra/core': patch
---

Updated the bundled provider SDKs used by the model router for Cerebras, DeepInfra, DeepSeek, Perplexity, Together AI, and OpenAI-compatible endpoints (including custom provider URLs and the Netlify gateway) to their AI SDK v6-compatible versions. This aligns them with the other providers in the model router (OpenAI, Anthropic, Google, Groq, Mistral, xAI, OpenRouter) which already use v6-compatible SDKs, and picks up upstream provider fixes. No changes to the public API: model strings like cerebras/llama-3.3-70b or deepseek/deepseek-chat keep working as before. Unused v5-track provider SDK bundles (Groq, Mistral, xAI, and the migrated providers above) were removed from the bundle.
