---
'@mastra/core': patch
---

Fix resource leak in `streamLegacy` cleanup by using `Promise.allSettled` for observer handlers and ensuring stream writer locks are always released.