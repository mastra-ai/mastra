---
'@mastra/factory': patch
---

Changed the observational memory defaults a factory gets when you connect a provider: Google and DeepSeek now seed OM with their small, cheap model instead of the model you selected for the factory, matching what Anthropic and OpenAI already did. Providers without a cheap OM model keep using your selected model, and OM models you already set are still left untouched.
