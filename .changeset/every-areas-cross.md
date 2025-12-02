---
'@mastra/observability': patch
---

Fix SensitiveDataFilter to redact structured data in JSON strings

- Fixed GitHub issue where SensitiveDataFilter failed to redact tool results in MODEL_STEP span input messages
