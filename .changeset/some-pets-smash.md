---
'@mastra/core': patch
---

Fixed structured output requests failing with a 400 "Requests ending with a model turn are not supported" error on Gemini 3 models when the conversation ends with an assistant message. Google, Vertex AI, and gateway-routed Gemini models now get the same trailing-message protection Anthropic models already had. Gemini 2.x is unaffected and keeps working exactly as before. Fixes #23320.
