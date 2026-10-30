---
'@mastra/agent-builder': patch
---

Fixed `require('@mastra/agent-builder')` failing with a module-not-found error. The package now ships a CommonJS build alongside the ES module build.
