---
'@mastra/core': patch
---

Fixed a denial-of-service risk in dataset schema validation. Regex `pattern` and `patternProperties` in dataset input and ground truth schemas now run on a linear-time engine, so a crafted pattern can no longer freeze the server. Fixes #24981.

Patterns using lookarounds or backreferences are now rejected with a clear error when the dataset is created or its schema is updated. To migrate, rewrite the pattern without them, for example replace `pattern: '^(?=.*\\d).+$'` with `pattern: '\\d'`, then update the dataset schema.
