---
'@mastra/core': patch
---

Fixed memory persistence when agent generation fails before any assistant output is produced. Failed turns no longer leave orphan user messages in thread history.
