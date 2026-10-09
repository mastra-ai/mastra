---
'@mastra/code-sdk': patch
'mastracode': patch
---

Update results now include their parts as separate fields (`via`, `command`, `details`, `installDir`, `runningVersion`, `ranWith`, `managedBy`) alongside `message`, so callers can lay them out. Added `describeUpdate(pm, version)` to show which tool and command an update will use before it runs.
