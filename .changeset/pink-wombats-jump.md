---
'@mastra/server': patch
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed the GitHub repo list failing with Not Found when a stored installation no longer exists on GitHub (app uninstalled or reconnected under different app credentials). Stale installations are now pruned automatically and the remaining ones are still listed, so the UI can prompt a fresh connect instead of erroring.
