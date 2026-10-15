---
'@mastra/code-sdk': patch
---

Improved the "Tenant model credential policy could not be resolved" error. It now states why resolution failed:

- The request has no authenticated user.
- No credential policy applies to the user.

Added a warning with non-secret diagnostics and a stack trace. Use it to locate where the request context was lost.
