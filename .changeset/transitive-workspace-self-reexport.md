---
'@mastra/deployer': patch
---

Fixed `mastra build` failing with `"<export>" cannot be exported from ".mastra/.build/<pkg>.mjs" as it is a reexport that references itself` when the app only reaches a workspace package through another workspace package, and those packages don't declare a `version`.
