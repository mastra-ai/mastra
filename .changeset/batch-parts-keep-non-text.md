---
'@mastra/core': patch
---

Fix `BatchPartsProcessor` dropping non-text parts when `emitOnNonText: false`. With that option, non-text parts (tool calls, tool results, objects, reasoning, etc.) are buffered alongside text in the batch, but `flushBatch` combined the text deltas and then cleared the whole batch, silently discarding any buffered non-text parts. It now emits the batch one part at a time, preserving order, so non-text parts are no longer lost.
