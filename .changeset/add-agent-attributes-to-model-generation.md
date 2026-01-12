---
'@mastra/core': patch
'@mastra/otel-exporter': patch
---

Add agentId and agentName attributes to MODEL_GENERATION spans. This allows users to correlate gen_ai.usage metrics with specific agents when analyzing LLM operation spans. The attributes are exported as gen_ai.agent.id and gen_ai.agent.name in the OtelExporter.
