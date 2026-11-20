---
'@mastra/code-sdk': minor
---

Added a Codex Fast preference for OpenAI subscription sign-in. Set `providerOptions: { mastracode: { codexServiceTier: 'fast' } }` on a request, or select a supported Codex model with `:fast` (for example, `openai/gpt-6.2-sol:fast`). The suffix is local and the preference never applies to API-key authentication. `:fast` requests Fast only on models that have a Fast tier (GPT-6.2 Sol and Astra, GPT-6.1 Sol and Terra, GPT-6 Astra, Sol and Luna, GPT-5.6, GPT-5.6 Sol, GPT-5.5 and GPT-5.4); on other models it has no effect. `withCodexFastModels()` adds these Fast entries to a model list.
