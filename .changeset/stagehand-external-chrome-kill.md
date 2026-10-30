---
'@mastra/stagehand': patch
---

Fixed the Stagehand browser not noticing when its Chrome is killed outside Mastra (for example with `kill` or a crash). Mastra now treats the lost connection as a disconnect, so the browser status changes to `closed` and the profile's lock files and "Chrome didn't shut down correctly" flag are cleaned up.
