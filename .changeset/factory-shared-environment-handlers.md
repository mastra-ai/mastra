---
'@mastra/factory': minor
---

Exported shared environment handlers so other servers can serve Factory's environment and sandbox env routes for their own projects. Import `EnvironmentHandlers` and `SandboxEnvHandlers` from `@mastra/factory/environment/handlers`, the request schemas from `@mastra/factory/routes/environment-contracts`, and `resolveProjectEnvironment` from `@mastra/factory/environment/session-environment` without loading the rest of Factory.
