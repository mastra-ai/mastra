---
'@mastra/playground-ui': patch
---

Studio's Recent Runs list now loads quickly for workflows with large snapshots. The list requests summary runs (status and timestamp only), and the full run is fetched only for the run you have open.
