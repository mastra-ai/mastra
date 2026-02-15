---
'@mastra/core': patch
---

Fixed Gemini API errors caused by empty reasoning parts stored in message memory. When using Gemini with reasoning tokens, empty reasoning parts could poison conversation history, causing all subsequent messages to fail with 'must include at least one parts field'. Empty reasoning parts are now filtered out before sending messages to the model, while preserving OpenAI encrypted reasoning parts that carry providerMetadata.
