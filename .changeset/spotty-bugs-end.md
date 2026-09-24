---
'@mastra/server': patch
'@mastra/core': patch
---

Fixed a denial-of-service risk in dataset schema validation. Regex `pattern` and `patternProperties` in dataset input and ground truth schemas now run on a linear-time engine, so a crafted pattern can no longer freeze the server. Patterns using lookarounds or backreferences are now rejected with a clear error when the dataset is created or its schema is updated. Fixes #24981.
