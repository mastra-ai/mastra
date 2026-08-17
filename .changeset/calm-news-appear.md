---
'@mastra/core': patch
---

Fixed workflow cancellation so sleep() and sleepUntil() stop promptly without overwriting the canceled run status.
