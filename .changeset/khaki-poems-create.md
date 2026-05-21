---
'@mastra/core': patch
---

Fixed an issue where thread subscriptions could appear idle after a run finished. Subsequent runs now stream promptly, and post-finish signals correctly start from an idle state.
