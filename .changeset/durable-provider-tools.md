---
'@mastra/inngest': patch
'@mastra/core': patch
---

Fixed durable agents mishandling provider-executed tools (like Anthropic web search). Calls whose result had not arrived yet no longer fail with ToolNotFoundError, and results are no longer committed twice, which previously overwrote their provider metadata.
