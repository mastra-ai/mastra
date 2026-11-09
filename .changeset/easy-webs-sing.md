---
'@mastra/core': minor
---

Added `buildEnv` and `buildEnvRevision` to `FactorySandboxContext`. Factory uses them to pass a factory's Build environment variables to template builds and setup steps without putting the values in the template identity. A provider should include `buildEnvRevision` (a random id that changes whenever the values change) in its template identity so an edit rebuilds the template. Both fields are optional, so existing providers keep working.
