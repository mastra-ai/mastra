---
'@mastra/otel-exporter': patch
'@mastra/observability': patch
---

Fixed model spans and OTel output dropping reasoning and provider-executed tool results. MODEL_STEP and MODEL_INFERENCE spans now record the messages the model returned for the current step, and gen_ai.output.messages exports reasoning parts and provider-executed tool results (#31439).
