---
'@mastra/server': patch
---

Stopped logging an error when a workspace route is called with an unknown workspace ID. The route still returns 404. Requires a `@mastra/core` version that supports `getWorkspaceById(id, { optional: true })`; with older cores the error is still logged.
