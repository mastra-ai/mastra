---
'@mastra/observability': patch
---

Skip impossible JSON prefixes in SensitiveDataFilter to avoid repeated parse exceptions for serialization markers while preserving valid embedded-JSON redaction.
