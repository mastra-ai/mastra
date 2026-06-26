---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/deployer': patch
'mastra': patch
'@mastra/deployer-cloud': patch
'@mastra/deployer-cloudflare': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer-vercel': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/nestjs': patch
'@mastra/next': patch
'@mastra/tanstack-start': patch
'@mastra/temporal': patch
---

Rename the `Harness` class to `AgentController` and its associated `Harness*` types to `AgentController*` (e.g. `HarnessConfig` → `AgentControllerConfig`, `HarnessMode` → `AgentControllerMode`, `HarnessEvent` → `AgentControllerEvent`).

`@mastra/core`: A new canonical subpath `@mastra/core/agent-controller` exports the `AgentController` class plus the `AgentController*` types. The legacy `@mastra/core/harness` subpath remains available and re-exports the deprecated `Harness*` aliases, so existing `Harness` class and type usage continues to work unchanged. New code should import from `@mastra/core/agent-controller`. On `Mastra`, the hosted-controller API is exposed under agent-controller names — `getAgentController`, `getAgentControllerById`, `listAgentControllers`, and the `agentControllers` config key — while `getHarness`/`getHarnessById`/`listHarnesses` and the `harnesses` config key remain as deprecated aliases.

`@mastra/server`: The controller session API is now served exclusively under `/agent-controller/...` (with `agent-controller:read` / `agent-controller:execute` permissions). The legacy `/harness/...` routes and `harness:*` permissions have been removed. List responses use the `agentControllers` key, session responses use `controllerId`, and path params use `:controllerId`.

`@mastra/client-js`: `AgentController` and `AgentControllerSession` are now the canonical resource classes, with `MastraClient.getAgentController(id)` / `listAgentControllers()` targeting the `/agent-controller` routes and reading the canonical `agentControllers` / `controllerId` response keys. The deprecated `getHarness` / `listHarnesses` methods and `Harness` / `HarnessSession` classes have been removed. This is a breaking change for the recently released client.

The `@mastra/core` peer dependency floor is raised to `>=1.47.0-0` so consumers must be on the release that introduces the canonical agent-controller surface. This applies to `@mastra/server`, `@mastra/deployer`, and `mastra` (CLI), and is propagated to the packages that depend on them: the deployers (`@mastra/deployer-cloud`, `@mastra/deployer-cloudflare`, `@mastra/deployer-netlify`, `@mastra/deployer-vercel`), the server adapters (`@mastra/express`, `@mastra/fastify`, `@mastra/hono`, `@mastra/koa`, `@mastra/nestjs`, `@mastra/next`, `@mastra/tanstack-start`), and `@mastra/temporal`.
