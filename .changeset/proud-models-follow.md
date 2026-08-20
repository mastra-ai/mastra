---
'@mastra/factory': patch
---

Provider-aware observational-memory defaults for factories. The factory creation wizard now fills the factory-scoped OM row (POST /web/config/om/provider-defaults accepts factoryId), and factory session hydration derives the OM fallback model from the factory's default model provider (e.g. anthropic/claude-haiku-4-5 when the default model is anthropic) instead of always using google/gemini-3.5-flash. GET/PUT OM routes report the same derived fallback so the settings UI no longer shows "Model credentials required" for factories whose default model provider is credentialed.
