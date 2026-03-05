---
'@mastra/memory': minor
---

Added `prepareContext` and `processResponse` public methods to `ObservationalMemory`, providing a simpler interface for loading observations and saving messages without requiring Mastra's Agent pipeline types (`MessageList`, `ProcessorContext`). Accepts raw `MastraDBMessage[]` and thread/resource identifiers directly.
