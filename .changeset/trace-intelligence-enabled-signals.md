---
'@mastra/playground-ui': patch
---

Fixed Trace Intelligence entity pages showing "No Trace Intelligence themes in this date range" for agents whose history includes a paused or disabled signal. Theme snapshots are now requested only for signals the catalog marks as enabled.
