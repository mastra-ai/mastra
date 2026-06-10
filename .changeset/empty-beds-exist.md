---
'@mastra/core': patch
---

Added anonymous, aggregated model token usage telemetry. When a Mastra server starts and observability metrics are enabled, the input and output token totals per provider and model are sent to Mastra's telemetry. Only aggregate token counts are collected — never prompts, responses, or message content. Opt out by setting MASTRA_TELEMETRY_DISABLED=1.
