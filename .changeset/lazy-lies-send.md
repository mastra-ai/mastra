---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed `MockMemory` so its working memory merge keeps parity with `@mastra/memory`: a `null` now deletes a field on the first write and inside newly created nested objects, instead of being stored literally.
