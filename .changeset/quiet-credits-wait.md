---
'@mastra/core': patch
---

Fixed `classifyProviderError` for two provider wordings. OpenAI's "You have no credits remaining" is now `quota` even when the error code is missing, and a quota error that says when to retry (Gemini's free tier: "Please retry in 45.06s") is now `rate_limited`, since it clears on its own.
