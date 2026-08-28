---
'@mastra/playground': patch
---

Refresh the dataset version history when items are added or deleted. Adding or removing an item creates a new dataset version on the server, but the version list stayed cached, so the new version only appeared after a manual reload.
