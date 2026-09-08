---
'@mastra/memory': patch
---

Observational memory's observer and reflector passes now trace as memory operations rather than generic spans, appearing as `memory: observe` and `memory: reflect`.

They also reported an output-step-processor entity type, which they are not — they wrap the model calls made inside the processor — so their runtimes were counted as processor overhead in `mastra_processor_duration_ms`.
