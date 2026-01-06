---
'@mastra/core': patch
---

Upgrade AI SDK v6 from beta to stable (6.0.1) and fix finishReason breaking change.

AI SDK v6 stable changed finishReason from a string to an object with `unified` and `raw` properties. Added `normalizeFinishReason()` helper to handle both v5 (string) and v6 (object) formats at the stream transform layer
