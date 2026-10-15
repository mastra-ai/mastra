---
'@mastra/code-sdk': patch
---

Made the "Tenant model credential policy could not be resolved" error say why it failed: either the request has no authenticated user, or no credential policy applies to that user. A warning with non-secret diagnostics and the stack trace is also logged, so you can find the caller that dropped the request context.
