---
'@mastra/core': patch
---

Fixed replies being saved as a separate assistant message on Gemini 3+ (and Anthropic 4.6+ with structured output) when the input ends on an assistant message. The reply is now saved into that assistant message, the same as with other providers. The synthetic user turn ("Continue." or "Generate the structured response.") Mastra sends to these providers is also no longer kept in the run's message list after the request is built.
