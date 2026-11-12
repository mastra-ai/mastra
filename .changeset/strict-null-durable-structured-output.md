---
'@mastra/core': patch
---

Fixed durable, evented, and Inngest agents rejecting strict-mode (OpenAI / Azure OpenAI) structured output when the model answers optional fields with `null`. The same null-to-undefined handling the regular agent applies is now applied on these engines.
