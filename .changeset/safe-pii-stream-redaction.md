---
'@mastra/core': patch
---

Withhold supported split regex PII safely across stream chunk boundaries and merge overlapping detections before redaction so neighboring text is preserved. Redacted streams may delay up to the bounded carryover suffix until a later text or non-text chunk.
