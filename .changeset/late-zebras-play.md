---
'@mastra/core': patch
---

Improved Knowledge graph loading by letting stores provide scoped graph and bulk note reads. The explorer bounds pagination by the requested graph size and reports an incomplete graph when a storage cursor stops advancing.
