---
'@mastra/valkey': patch
---

Fixed workflow snapshots for resource-scoped runs not loading, updating, listing or deleting correctly. A snapshot written with a resource ID is now stored under a canonical key derived from the workflow name and run ID, so it stays readable by load, update, list and delete. Existing resource-suffixed snapshots are still readable and are removed when a run is deleted. Fixes #31142.
