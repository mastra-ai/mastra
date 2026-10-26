---
'@mastra/observability': patch
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed tool calls and nested workflows in durable agent runs losing their request context metadata. `hideInput` and `hideOutput` now stay in effect for those spans too. Inngest workflow and step spans keep the same settings when a run continues in a later step.
