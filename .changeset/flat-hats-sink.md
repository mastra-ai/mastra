---
'mastracode': patch
---

Fixed pending GitHub PR notifications so they are delivered after the active response finishes instead of staying queued. Merge conflict notifications are now rechecked before delivery so resolved conflicts do not appear later as stale alerts.
