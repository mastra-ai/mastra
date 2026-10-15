---
'@mastra/factory': patch
---

Fixed new Factory sessions starting on the built-in mode model instead of your default model. When a session opened before its chat thread was attached, your default went to a thread the chat never used, so the first message could run on a model you have no credentials for and fail with a provider authentication error.
