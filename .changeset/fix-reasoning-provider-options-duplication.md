---
"@mastra/core": patch
---

Fix providerOptions loss and reasoning part duplication when convertToModelMessages splits messages at step-start markers. This ensures OpenAI GPT-5 reasoning itemId is preserved during recursive tool calls and prevents duplicate reasoning parts from appearing in multiple assistant messages.

