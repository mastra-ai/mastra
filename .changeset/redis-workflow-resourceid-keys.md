---
'@mastra/redis': patch
---

Fixed Redis workflow runs created with a `resourceId` that could not be resumed or deleted. Snapshots are now stored under a key built from the workflow name and run ID only, with `resourceId` kept as a field on the record. Runs saved by earlier versions under keys that include `resourceId` can still be loaded, updated, listed and deleted.
