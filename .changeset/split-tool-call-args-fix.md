---
"@mastra/core": patch
---

Fixes tool call args being lost when split across messages in client tools. When a tool invocation spans multiple messages (call with args, result with empty args), the `findToolCallArgs` function now continues searching for non-empty args instead of returning the first match.

