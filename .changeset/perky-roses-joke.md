---
'@mastra/core': patch
---

Fixed `createStep(tool)` sometimes misinterpreting a tool as a custom step. Copied or renamed tools — such as tools resolved through a tool provider — are now correctly detected and build a proper tool step. This applies to both the default `createStep` and the one exported from `@mastra/core/workflows/evented`.
