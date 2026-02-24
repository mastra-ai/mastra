---
'@mastra/core': patch
---

Prevent unknown model IDs from being sorted to the front in `reorderModels()`. Models not present in the `modelIds` parameter are now moved to the end of the array. Fixes #13410.
