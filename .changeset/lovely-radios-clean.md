---
'@mastra/ai-sdk': patch
---

Extend the workflow route to accept optional runId and resourceId
parameters, allowing clients to specify custom identifiers when
creating workflow runs. These parameters are now properly validated
in the OpenAPI schema and passed through to the createRun method.

Also updates the OpenAPI schema to include previously undocumented
resumeData and step fields.
