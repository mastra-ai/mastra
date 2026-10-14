---
'@mastra/otel-exporter': patch
---

Exports time to first chunk: `gen_ai.response.time_to_first_chunk` (seconds) on model inference spans and `mastra.time_to_first_chunk_ms` on model step, model generation and agent run spans.
