---
'@mastra/factory': patch
---

Fixed automated runs abandoning their session when a run is re-prepared (for example after a server restart). The run now lands back in the work item's existing session for that role instead of creating a replacement — so the session keeps its original owner instead of switching to whoever approved the run, and no orphaned sandbox is left behind.
