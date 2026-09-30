---
'@mastra/editor': patch
---

Fixed `editor.scorer.clearCache()` leaving stored scorers registered on Mastra after they were loaded with a specific version (`getById(id, { versionId })` or `{ versionNumber }`). Clearing the whole cache now unregisters them, so a later default `getById` registers the latest scorer instead of staying stuck on the historical one.
