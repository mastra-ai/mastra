---
'@mastra/core': patch
---

Fixed Stop to cancel paused runs through their owning agent after a mode switch or later navigation, including when reopening a saved session. Other threads, resources and runs created after Stop remain untouched. Shutdown waits for owner discovery, and reports an error if a paused run's owner cannot be found.
