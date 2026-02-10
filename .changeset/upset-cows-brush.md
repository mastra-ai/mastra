---
'@mastra/core': patch
---

Fixed Workflow type incompatibility with Mastra constructor when using requestContextSchema. Workflows with a requestContextSchema can now be passed to `new Mastra({ workflows: { ... } })` without a `#private` type error. Also introduced an `AnyWorkflow` type alias to prevent this class of issue in the future.
