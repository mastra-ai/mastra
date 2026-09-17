---
'@mastra/core': patch
---

Fixed requests failing with a 400 "Requests ending with a model turn are not supported" error on Gemini 3 models when the conversation ends with an assistant message. The trailing-message guard that Anthropic models already had under native structured output now also covers Google, Vertex AI, and gateway-routed Gemini 3+ models, for every request rather than only structured output ones. Assistant messages that end on a tool result are left alone, since the prompt already ends on a tool turn. Gemini 2.x and Anthropic prefill behavior are unchanged. Fixes #23320.
