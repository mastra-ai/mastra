---
'@mastra/core': minor
---

Added `getRunAgentScopes`, which returns a request context's `mastra__scopes` only when Mastra set them for the current run. Use it instead of the raw request-context key when a scope grants access to shared data. Agentic Knowledge imports now pass their identity as `resource:`/`thread:` agent scopes.
