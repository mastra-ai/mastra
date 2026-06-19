---
'@mastra/core': patch
---

Fixed direct agent streams so thread subscriptions do not consume output before callers can read it.
