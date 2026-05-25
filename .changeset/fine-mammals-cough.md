---
'@mastra/core': patch
---

Fixed delay when switching agent modes. Mode changes now update the UI immediately. Added 10s TTL cache for available models list to speed up modal opens. Made provider capabilities loading lazy instead of bulk-syncing on every registry access.
