---
'@mastra/observability': patch
'@mastra/core': patch
---

Fixed tool calls and nested workflows in durable agent runs losing their request context metadata. `hideInput` and `hideOutput` now stay in effect for those spans too.
