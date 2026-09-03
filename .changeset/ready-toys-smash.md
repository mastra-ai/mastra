---
'@mastra/trace-import': minor
---

Added resumable Langfuse trace imports for Mastra Platform. The importer preserves source timestamps, raw V2 I/O, pricing-tier data, and metadata; safely handles logical application roots and fixed-snapshot completion; checkpoints acknowledged batches; and verifies a deterministic trace sample through the Platform query API.

```bash
mastra traces import --provider langfuse --dry-run
```
