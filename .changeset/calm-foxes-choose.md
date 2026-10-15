---
'@mastra/factory': patch
---

Factory sessions and work-item runs can now start on a model you have credentials for. This applies when no default model was chosen and the built-in default model has no credential.

The session uses the default model of a provider you have connected, for example `anthropic/claude-fable-5` for Claude or `openai/gpt-5.6-sol` for ChatGPT. A default you or your Factory chose always wins. The fallback is not saved as a default preference.
