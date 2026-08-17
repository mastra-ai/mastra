---
'@mastra/core': patch
---

Stop input processors from corrupting the persisted memory view. An input processor that rewrites the message array (e.g. `ToolCallFilter`, which strips `tool-invocation` parts for the LLM prompt) was mutating the same `MessageList` that backs the persisted/remembered view, so stored `tool-invocation` parts were reported as their filtered copies. Remembered (memory-sourced) messages are now snapshotted as loaded from storage, and `getPersisted.remembered` serves that original snapshot — the LLM-input view still sees the processor's transforms, but the persisted view no longer does.
