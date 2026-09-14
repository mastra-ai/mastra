---
'@mastra/core': patch
---

Include token `usage` diagnostics in the `STRUCTURED_OUTPUT_OBJECT_UNDEFINED` error thrown when a workflow agent step declares a structured-output schema but produces no object, so loggers and workflow error consumers retain the finish result's usage data.
