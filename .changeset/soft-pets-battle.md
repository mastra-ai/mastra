---
'@mastra/core': patch
---

Added `filterIncompleteToolCalls` option to memory config. When set to `false`, suspended tool calls remain visible in the agent's prompt context, allowing the agent to see its own pending interactions in thread history. Defaults to `true` (current behavior). Useful for suspend/resume patterns with providers that support incomplete tool calls (e.g. Anthropic).
