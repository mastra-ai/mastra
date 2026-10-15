---
'@mastra/otel-exporter': patch
---

Fixed tool calls going missing from `gen_ai.output.messages`. A model step that only calls tools is now exported as an assistant message with `tool_call` parts instead of an empty text message. Inference span inputs are also converted to the GenAI message format.
