---
'@mastra/core': patch
---

Fixed model router requests through OpenRouter failing with a 400 "thinking blocks cannot be modified" error when an Anthropic model (e.g. openrouter/anthropic/claude-sonnet-4-6) used extended thinking together with parallel tool calls. The bundled OpenRouter provider was updated from 1.5.4 to 2.10.0, which no longer duplicates reasoning details on each tool call when sending conversation history back to the API. Fixes #19436
