---
'@mastra/code-sdk': patch
---

Factory sessions now always use resource-scoped observational memory, so a Factory's runs share one memory record and a user's sessions share another. Session state, the `MASTRA_OM_SCOPE` environment variable, and `.mastracode/database.json` no longer change the scope for Factory sessions. Mastra Code outside Factory resolves the scope as before.
