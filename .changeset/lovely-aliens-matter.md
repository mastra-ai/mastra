---
'@mastra/convex': patch
---

Removed the Convex adapters' only Node builtin dependency. ConvexStore, the vector adapters, and the storage domains now use the Web Crypto API (crypto.randomUUID) instead of importing node:crypto, so @mastra/convex itself no longer requires the Node.js runtime ("use node") to bundle inside a Convex project.
