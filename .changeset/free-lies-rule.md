---
'@mastra/core': patch
---

Fix Zod 4 compatibility for storage schema detection

If you're using Zod 4, `buildStorageSchema` was failing to detect nullable and optional fields correctly. This caused `NOT NULL constraint failed` errors when storing observability spans and other data.

This fix enables proper schema detection for Zod 4 users, ensuring nullable fields like `parentSpanId` are correctly identified and don't cause database constraint violations.
