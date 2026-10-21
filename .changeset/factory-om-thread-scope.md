---
'@mastra/code-sdk': patch
---

Factory sessions now always use thread-scoped observational memory. Each run and chat keeps its own observations, and recall search still reaches every thread under the Factory or user resource. Session state, the `MASTRA_OM_SCOPE` environment variable, and `.mastracode/database.json` no longer change the scope for Factory sessions. Mastra Code outside Factory resolves the scope as before.
