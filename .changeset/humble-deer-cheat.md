---
'@mastra/otel-exporter': patch
'@mastra/otel-bridge': patch
'@mastra/langfuse': patch
'@mastra/arthur': patch
'@mastra/sentry': patch
'@mastra/arize': patch
---

Agent runs with tools now show the tool list in Langfuse. The input of the agent observation is now `{ "prompt": "...", "tools": [...] }` instead of plain text. Update evaluators or datasets that read this input as plain text.
