---
'@mastra/code-sdk': patch
---

Mastra Code now carries a session's Knowledge identity as `org:`/`project:` agent scopes marked as run-derived, so agent scope resolution trusts them behind an older server. The Knowledge inspector reads the project from those scopes.
