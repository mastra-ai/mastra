---
'@mastra/code-sdk': patch
---

Kimi For Coding models now report `kimi-for-coding` as their provider (instead of `anthropic.messages`) so message history compatibility can tell Kimi turns apart from Anthropic turns when a thread switches between them.
