---
'@mastra/trace-import': minor
---

Added resumable Langfuse trace imports for Mastra Platform. The importer preserves source timestamps, raw V2 I/O, and metadata; validates unusual and incomplete trace trees; checkpoints acknowledged batches; and verifies a deterministic trace sample through the Platform query API.
