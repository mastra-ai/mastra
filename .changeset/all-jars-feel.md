---
'@mastra/core': patch
---

When using agent networks, the routing agent could fail with a cryptic TypeError: Cannot read properties of undefined (reading 'primitiveId') if the object from tryGenerateWithJsonFallback was undefined. This adds a guard that throws a descriptive MastraError with debugging details (response text, finish reason, usage) to help users diagnose the issue.
Fixes #11749
