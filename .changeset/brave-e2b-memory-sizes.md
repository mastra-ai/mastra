---
'@mastra/e2b': patch
---

Changed the Factory sandbox memory setting from a free-form MB field to a dropdown of sizes: 512 MB, 1 GB, 2 GB, 4 GB or 8 GB, matching E2B's 8 GB limit. Memory set through the `defaults` option in code is unaffected.
