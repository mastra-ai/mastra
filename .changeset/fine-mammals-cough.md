---
'@mastra/core': patch
---

Made provider capabilities loading lazy instead of bulk-syncing on every registry access. Removed subscription setup from harness switchMode() — subscriptions are now lazily ensured at send time. Added 10s TTL cache and invalidation method for listAvailableModels().
