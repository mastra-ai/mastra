---
'mastracode': patch
---

The setup flow now detects API keys for all providers listed in the model registry, not just a fixed set.
Users with API keys for providers like Groq, Mistral, or any supported provider will no longer see a "No model providers configured" error.
Missing provider detection is now a warning, allowing users to continue setup.
