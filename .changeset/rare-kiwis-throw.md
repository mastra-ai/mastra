---
'@mastra/core': patch
---

Fixed workflow request context serialization to skip values that cannot be safely stored as JSON. Fixes #16043.
