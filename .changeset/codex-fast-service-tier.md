---
'@mastra/code-sdk': patch
---

Added a Codex Fast preference for OpenAI subscription sign-in. Set `providerOptions: { mastracode: { codexServiceTier: 'fast' } }` on a request, or select a supported Codex model with `:fast` (for example, `openai/gpt-6.2-sol:fast`). The suffix is local and the preference never applies to API-key authentication.
