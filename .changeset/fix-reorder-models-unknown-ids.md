---
'@mastra/core': patch
---

Fix `reorderModels()` sorting unknown model IDs to the front of the list instead of keeping them at the end. Models not present in the `modelIds` parameter now sort to the end of the array, preventing them from silently becoming the primary model.
