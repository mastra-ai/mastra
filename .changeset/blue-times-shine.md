---
'@mastra/core': patch
---

Fixed an issue where generating a response in an empty thread (system-only messages) would throw an error. Providers that support system-only prompts like Anthropic and OpenAI now work as expected. A warning is logged for providers that require at least one user message (e.g. Gemini). Fixes #13045.
