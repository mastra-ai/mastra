---
'@mastra/observability': patch
---

Fixed span serialization so internal tracing fields are removed only from framework-owned payloads while preserving user data with the same key names.
