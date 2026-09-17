---
'@mastra/core': patch
---

Fixed requests failing with a 400 "Requests ending with a model turn are not supported" error on Gemini 3 models when the conversation ends with an assistant message. The trailing-message guard that Anthropic models already had under native structured output now also covers Google, Vertex AI, and gateway-routed Gemini 3+ models, for every request rather than only structured output ones, and still applies when an input processor switches the model mid-step. The guard now mirrors prompt conversion exactly: it leaves assistant messages that end on a tool result alone, and correctly guards history that ends on assistant text followed by an unfinished tool call. `PrefillErrorHandler` also recognizes the Gemini error so the reactive retry path covers it too. Gemini 2.x and Anthropic prefill behavior are unchanged. Fixes #23320.
