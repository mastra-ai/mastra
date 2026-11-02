---
'@mastra/mysql': patch
---

Fixed experiment result writes putting plaintext back over a purged dataset item. When a purge committed while a result was being written, the writer could miss the purge marker and overwrite the redacted input, output, ground truth, error and metadata.
