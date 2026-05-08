---
'@mastra/core': minor
---

Added harness storage domain (`HarnessStorage`) under `@mastra/core/storage` for the upcoming Harness v1. The domain stores SessionRecords, lease metadata, and attachments. Exposed alongside the existing storage domains via `MastraCompositeStore.stores.harness`. Includes a real `InMemoryHarness` adapter with optimistic-CAS writes, lease-based ownership, and attachment cascade-delete on session removal. This is internal infrastructure — no public-facing API yet.
