---
'@mastra/core': patch
---

When using agent networks, the routing agent could fail with a cryptic `TypeError: Cannot read properties of undefined` if the generation response was missing or malformed. This made it difficult to diagnose why routing failed. The release now throws a descriptive error with debugging details (response text, finish reason, usage) to help identify the root cause.

Fixes #11749
