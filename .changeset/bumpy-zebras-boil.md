---
'@mastra/core': patch
---

Moved Gemini first-user-message compatibility check from core message list into the ProviderHistoryCompat processor. The fix is now scoped to Google models only via the existing provider-compat rule system, instead of being applied unconditionally to all providers.
