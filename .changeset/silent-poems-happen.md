---
'@mastra/code-sdk': patch
---

Stopped logging an error each time the Mastra Code workspace is created for a new project. Requires a `@mastra/core` version that supports `getWorkspaceById(id, { optional: true })`; with older cores the error is still logged.
