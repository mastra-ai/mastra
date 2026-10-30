---
'@mastra/lance': patch
---

Fixed the `LanceVectorStore.create()` type so `id` is optional when you pass connection options. The store already generated a random ID for you, so passing `storageOptions` or other connection settings without an `id` now type-checks.
