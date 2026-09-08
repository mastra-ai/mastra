---
'@mastra/observability': patch
---

Fixed `mastra_processor_duration_ms` counting spans that borrow a processor entity type without being processor runs. Observational memory's model passes were tagged as output-step processors, so seconds-long model calls were reported as processor overhead.
