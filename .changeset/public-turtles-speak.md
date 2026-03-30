---
'@mastra/server': patch
'@mastra/core': patch
---

Aligned workspace tool config types with core's dynamic function support. Dynamic config functions (enabled, requireApproval, requireReadBeforeWrite) are now resolved by calling them with workspace and requestContext, matching core's behavior.
