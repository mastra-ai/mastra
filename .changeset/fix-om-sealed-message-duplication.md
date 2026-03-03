---
'@mastra/memory': patch
---

Fixed duplicate user messages when observational memory async buffering is active. Sealed-for-buffering messages without observation markers are now skipped in per-step save instead of being re-saved with new IDs.
