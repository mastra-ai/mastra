---
'@mastra/playground-ui': patch
---

Fixed two issues on the virtualized Logs and Traces lists: column widths no longer shift while scrolling, and Logs no longer break after loading multiple pages (`selectLogs` now deduplicates rows that offset-based pagination produces at page boundaries).
