---
'@mastra/otel-exporter': patch
'@mastra/arize': patch
'@mastra/core': patch
---

Fixed formatting of model_step, model_chunk, and tool_call spans in Arize Exporter.

Also removed `tools` output from `model_step` spans for all exporters.
