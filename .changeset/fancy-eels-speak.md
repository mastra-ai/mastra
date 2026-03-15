---
'mastracode': patch
---

Fixed setup flow to detect API keys for all providers in the model registry, not just the five hardcoded ones (Anthropic, OpenAI, Cerebras, Google, DeepSeek). Users with API keys for other supported providers like Groq, Mistral, or any provider in the registry will no longer see a "No model providers configured" error. Changed the missing provider error to a warning that allows users to continue setup.
