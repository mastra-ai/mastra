---
'@mastra/deployer': patch
---

Fixed an uncaught `ERR_INVALID_STATE: Controller is already closed` on MCP HTTP routes when a client disconnects while the server still writes to the response. The existing `fetch-to-node` patch was never applied because it was missing from `patchedDependencies`.
