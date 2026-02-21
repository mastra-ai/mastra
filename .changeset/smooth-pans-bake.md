---
'@mastra/core': patch
---

Fixed Gemini API errors caused by empty reasoning parts stored in message memory. Empty reasoning from providers like Gemini is no longer stored when there's no content or providerMetadata. For OpenAI, empty reasoning with providerMetadata (needed for item_reference) is preserved without creating empty details entries. A sanitize safety net is retained for legacy stored data.
