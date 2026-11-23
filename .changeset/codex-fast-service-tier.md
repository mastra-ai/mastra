---
'@mastra/code-sdk': minor
---

Added a Codex Fast preference for OpenAI subscription sign-in. Set `providerOptions: { mastracode: { codexServiceTier: 'fast' } }` on a request, or select a supported Codex model with `:fast` (for example, `openai/gpt-6.2-sol:fast`). The suffix is local and the preference never applies to API-key authentication. `:fast` requests Fast only on models that have a Fast tier (see the Codex fast section of the Mastra Code configuration docs for the list); on other models it has no effect. `withCodexFastModels()` adds these Fast entries to a model list.
