---
'@mastra/observability': patch
---

Fixed rebuilt spans losing their trace settings. Spans created under a rebuilt span, such as every tool call and workflow in a durable agent run, now extract the configured request context keys again and keep honouring `hideInput` and `hideOutput`.
