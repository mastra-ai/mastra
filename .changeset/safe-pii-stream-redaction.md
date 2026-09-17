---
'@mastra/core': patch
---

Fixed streamed `PIIDetector` redaction so sensitive values split across chunks are redacted and overlapping detections do not remove neighboring text. Redacted streams may briefly delay trailing text until a later text or non-text chunk.
