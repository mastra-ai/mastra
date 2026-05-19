---
'@mastra/observability': minor
---

`MastraStorageExporter` now emits structured drop events through `onDroppedEvent` so custom exporters and integrations can observe unsupported-storage and retry-exhausted drops. This mirrors the existing `DefaultExporter` behavior.
