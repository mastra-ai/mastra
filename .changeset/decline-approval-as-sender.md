---
'@mastra/core': patch
---

Fixed "Tenant model credential policy could not be resolved: the request has no authenticated user" errors that recurred on every message in a session with a pending tool approval. When a new user message declines a pending approval, the decline now runs with the sender's request context instead of the reattached run's empty one.
