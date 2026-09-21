---
'@mastra/core': patch
---

Fixed workflow restart at completed boundaries and reduced durable-agent snapshot writes while preserving completed results, restart intent, and changes made during storage I/O.

Checkpoint reuse also works when native memory adds live request context callbacks. Stored values and live context remain unchanged; custom encodings and application accessors retain ordinary persistence.
