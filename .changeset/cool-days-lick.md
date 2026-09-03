---
'@mastra/observability': patch
'@mastra/core': patch
---

Improved internal observability packaging by preserving existing `@mastra/core/observability` and `@mastra/core/storage` imports while making embedded observability contracts and no-op detection safe across independently bundled package copies.
