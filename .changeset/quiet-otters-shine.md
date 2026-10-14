---
'@mastra/otel-exporter': patch
---

Exports time to first chunk: `gen_ai.response.time_to_first_chunk` (seconds) on model inference spans and `mastra.time_to_first_chunk_ms` on model step, model generation and agent run spans. Raised the `@mastra/core` peer dependency floor to `1.78.0`, the first release that provides the helper this needs.
