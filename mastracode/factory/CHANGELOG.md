# @mastra/factory

## 0.1.0-alpha.6

### Patch Changes

- The Factory's default `publicUrl` is now `http://localhost:4111` (the Factory server, which serves both the UI and the API) instead of `http://localhost:5173`. Generated Factory projects now run from a single server, so OAuth callback URLs and auth redirects derived from `publicUrl` point at the right origin out of the box. If you serve the SPA from a separate origin (for example a Vite dev server on :5173), set `publicUrl` (or `MASTRACODE_PUBLIC_URL`) explicitly. ([#20036](https://github.com/mastra-ai/mastra/pull/20036))

## 0.1.0-alpha.5

### Patch Changes

- Fixed a server startup crash when the factory's storage backend could not be recognized by the SDK. The factory now tells the SDK explicitly whether its Mastra store is Postgres or LibSQL, so agent state wiring works even when the project's dependency graph contains duplicate copies of Mastra packages. ([#20030](https://github.com/mastra-ai/mastra/pull/20030))

- Updated dependencies [[`b06a569`](https://github.com/mastra-ai/mastra/commit/b06a56958d683e45574d2e3806dca42db5fe8a7a)]:
  - @mastra/code-sdk@1.0.0-alpha.17

## 0.1.0-alpha.4

### Patch Changes

- Moved custom model providers and custom model packs off settings.json in the factory web app: both now live in the app database (org-scoped rows in deployed mode, a sentinel local scope in no-auth mode). Custom providers saved in the web settings page are picked up by model resolution and the model catalog through a new pluggable custom-providers source in the SDK, so the gateway no longer reads the host machine's settings.json for them, and models from your custom providers appear in the web model pickers. ([#19964](https://github.com/mastra-ai/mastra/pull/19964))

  Hosts that store custom providers elsewhere (like the factory's database) register a source at boot; when none is registered, the SDK keeps reading settings.json as before:

  ```ts
  import { setCustomProvidersSource } from '@mastra/code-sdk/agents/custom-provider-source';

  setCustomProvidersSource(tenant => (tenant ? snapshotForOrg(tenant.orgId) : []));
  ```

- Added a memory-settings storage domain: observational memory settings (observer and reflector models, thresholds, attachment observation) changed in the web app are now stored in the app database — one row per user — instead of settings.json, and the settings page reads them back from the database. Factory-mounted agent controllers no longer seed observational memory settings from the host machine's settings.json (new `disableSettingsOmSeed` SDK option), so server sessions start from built-in defaults plus whatever is stored in the database. The OM settings model pickers in the web UI are now searchable comboboxes. ([#19964](https://github.com/mastra-ai/mastra/pull/19964))

  Server embedders that persist memory settings in their own database can opt out of the settings.json seed:

  ```ts
  import { createMastraCode } from '@mastra/code-sdk';

  const mastraCode = await createMastraCode({
    cwd: process.cwd(),
    // Don't seed observer/reflector models or thresholds from the host
    // machine's settings.json — sessions start from built-in defaults.
    disableSettingsOmSeed: true,
  });
  ```

- Updated dependencies [[`eec6a54`](https://github.com/mastra-ai/mastra/commit/eec6a54c64cd365c9b75c14a02e32122ad5f657c), [`eec6a54`](https://github.com/mastra-ai/mastra/commit/eec6a54c64cd365c9b75c14a02e32122ad5f657c)]:
  - @mastra/code-sdk@1.0.0-alpha.16
  - @mastra/core@1.52.0-alpha.13

## 0.1.0-alpha.3

### Patch Changes

- Forwarded closed Platform GitHub event-log deliveries into Factory governance before dispatching repository subscriptions, and kept default GitHub rules from auto-starting issues or pull requests created before the Factory. ([#19988](https://github.com/mastra-ai/mastra/pull/19988))

- Deployed factories now authenticate API and Studio requests with the same provider, so Studio sessions work without extra configuration. ([#19966](https://github.com/mastra-ai/mastra/pull/19966))

- Fixed cloned session threads reading from a previous storage instance. The dynamic memory cache now invalidates when the storage or vector instance changes, so thread cloning always uses the current database. ([#19966](https://github.com/mastra-ai/mastra/pull/19966))

- Updated dependencies [[`cc656b9`](https://github.com/mastra-ai/mastra/commit/cc656b92cc8fe40af3e2ea8bb796a6b406e96791), [`cc656b9`](https://github.com/mastra-ai/mastra/commit/cc656b92cc8fe40af3e2ea8bb796a6b406e96791), [`337d41d`](https://github.com/mastra-ai/mastra/commit/337d41d8aae0399d2bf42d42ebddac0c21953891)]:
  - @mastra/code-sdk@1.0.0-alpha.15

## 0.1.0-alpha.2

### Patch Changes

- Fixed Factory metrics windowing to use inclusive UTC calendar days. Date-only `from`/`to` bounds now include both selected days, an item completing at the current instant is counted in today's throughput (previously it could be dropped on the window's exclusive edge), and `windowDays` reflects the number of gap-filled day buckets. Cards feed the source mix only when created inside the window. ([#19971](https://github.com/mastra-ai/mastra/pull/19971))

- Fixed duplicate repositories in Factory source control settings. ([#19971](https://github.com/mastra-ai/mastra/pull/19971))

- Fixed Factory automation so polled GitHub events reach governance rules, authenticated sessions start with the correct ownership, and board moves reliably notify active or idle agents. ([#19979](https://github.com/mastra-ai/mastra/pull/19979))

## 0.1.0-alpha.1

### Minor Changes

- Move the Factory project CRUD and source-control connection routes into `@mastra/factory` as a `ProjectRoutes` class. The routes take their storage handles (`FactoryProjectsStorage`, `SourceControlStorage`), the allowed version-control integration ids, and a `RouteAuth` adapter at construction time, replacing the old `ProjectDomain` that resolved domains through the `FactoryStorage` registry. The now-unused `FactoryDomain` base class was removed from the web host. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the audit domain, agent git-action auditing, intake capabilities, and intake routes into `@mastra/factory`. `AuditDomain` now takes its storage handles (`AuditStorage`, `FactoryProjectsStorage`) and a `RouteAuth` adapter directly instead of resolving them through the factory storage registry, fans out to pluggable `AuditSink`s, and resolves agent tenants through an injected `agentTenant` callback. Intake routes ship as an `IntakeRoutes` class that calls `IntakeStorage` directly (the intermediate intake store module was removed). ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the `FactoryIntegration` contract and the OAuth `state` signer into `@mastra/factory`. The integration interface (routes, tools, diagnostics, intake/version-control capabilities, `IntegrationContext`) now lives at `@mastra/factory/integrations/base`, and `createStateSigner`/`StateSigner` at `@mastra/factory/state-signing`, so integrations can be implemented against the package without importing the web host. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Added the @mastra/factory package. It now owns the Software Factory storage domains (projects, work items, intake, audit, credentials, integrations, model packs, queue health, source control) that previously lived inside the mastracode web app, so they can be reused outside the web server. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Moved the server config routes and provider credential helpers into @mastra/factory as a reusable ConfigRoutes class. Route handlers now receive their auth checks through an injected RouteAuth seam and storage domains through constructor options, so hosts other than the Mastra Code web app can mount the same routes. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the Factory work-item (kanban board) routes into `@mastra/factory` as a `WorkItemRoutes` class. The routes take their storage handles (`WorkItemsStorage`, `FactoryProjectsStorage`, `QueueHealthStorage`), an `AuditEmitter`, and a `RouteAuth` adapter at construction time. The request-body validators (`parseCreateWorkItem`, `parseUpdateWorkItem`) now live with the routes, the pass-through work-item store module was removed in favor of calling `WorkItemsStorage` directly, and `computeFactoryMetrics` takes a single object parameter. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

### Patch Changes

- Move the WorkOS audit integration into `@mastra/factory/integrations/workos`. Its Admin Portal route now resolves the caller through the `RouteAuth` seam on `IntegrationContext` instead of web-host auth helpers, and `@mastra/auth-workos` becomes a package dependency. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the factory auth module into `@mastra/factory/auth`. The provider-neutral ([#19866](https://github.com/mastra-ai/mastra/pull/19866))
  auth gating (`mountFactoryAuth`, `buildAuthRoutes`, `createFactoryAuthGate`),
  the `RouteAuth` implementation (`createFactoryRouteAuth`), and the WorkOS/SSO
  helpers now live next to the route seam they implement, with factory naming
  throughout.

- Track per-stage automation in Factory metrics. Stage history now stamps the exiting actor (`exitedBy`) alongside the entering one, `isAutomationActor` classifies rules-engine, agent (`agent:*`), and webhook (`github:*`) actors as automation, and `computeFactoryMetrics` reports a `stageAutomation` breakdown per stage: how many passes were fully automated (entered and exited by automation on the first visit) and how those automated passes ended up (`done`, `canceled`, `reworked`, or still in flight). Adds the `canceled` terminal stage to the board vocabulary (`FACTORY_RULE_STAGES`) — a tracked non-completion that feeds neither throughput nor cycle time — and rewords organization-required errors to be auth-provider neutral. ([#19844](https://github.com/mastra-ai/mastra/pull/19844))

- Fixed @mastra/factory build output so published modules use explicit .js import extensions and resolve correctly under Node ESM ([#19954](https://github.com/mastra-ai/mastra/pull/19954))

- Move the API-surface assembler from mastracode/web into @mastra/factory as `routes/surface` — `assembleWebApiRoutes` is now `assembleFactoryApiRoutes` and `WebApiRoutesDeps` is now `FactoryApiRoutesDeps`. The module composes fs/config/oauth/skills/intake/work-item routes plus every registered integration's route surface (with disabled-status stubs for absent github/linear integrations) from explicitly threaded dependency handles. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the GitHub integration and the sandbox fleet into `@mastra/factory`. The fleet is now a DI-constructed `SandboxFleet` class (`@mastra/factory/sandbox/fleet`) that owns provisioning, reattach, teardown, idle windows, and per-replica budgets instead of reading a seeded runtime-config registry. The GitHub routes, webhook, sandbox materialization, project locks, and session subscriptions (`@mastra/factory/integrations/github`) resolve tenants through the `RouteAuth` seam and receive the fleet and factory storage via `IntegrationContext`, so the web host no longer exports `getSeededSandbox`/`getSeededGithubIntegration` service locators. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the filesystem routes (`@mastra/factory/routes/fs`) and skill routes (`@mastra/factory/routes/skills`) into `@mastra/factory`. The skill prepare/invoke routes are now a `SkillRoutes` class that resolves users and tenants through the `RouteAuth` seam instead of web-host auth helpers. Diagnostics fields exposed by the GitHub and Linear integrations rename `webAuthEnabled` to `factoryAuthEnabled` to match the package's auth seam naming. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the Linear integration into `@mastra/factory/integrations/linear`. `LinearIntegration` now owns the full connection lifecycle (OAuth token exchange, single-flight refresh, scope checks, and connection caching) as class methods, the routes and agent tools resolve tenants through the `RouteAuth` seam instead of web-host auth imports, and the `getSeededIntegration` runtime-config indirection is gone — the host hands the integration instance and storage handles directly via `initialize()`. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the `MastraFactory` assembly root into `@mastra/factory`. `factory-entry.ts` now lives at the package root export (`@mastra/factory`), alongside the extracted `workspace`, `spa-static`, `server-error`, and `sandbox/reattach` helpers. Factory skills ship with the package and are copied into deploy output via the consuming app's build script. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Updated dependencies [[`a4d7c7d`](https://github.com/mastra-ai/mastra/commit/a4d7c7d74f423efc73b3e4db8142478763e6989d), [`d7385ad`](https://github.com/mastra-ai/mastra/commit/d7385ad9e88f9e4f33d15c0ec0bfebedde0cbc2e), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`35865a5`](https://github.com/mastra-ai/mastra/commit/35865a53e194aa9634d6a70a97010e7a6b9d58b1), [`70687f7`](https://github.com/mastra-ai/mastra/commit/70687f7e495a322a02070b4a67cb0c77a5ca91ec), [`9bffb73`](https://github.com/mastra-ai/mastra/commit/9bffb73e9ea46f48b53205b35a69a57f70912c78), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`b87e4ca`](https://github.com/mastra-ai/mastra/commit/b87e4cad9acf70e58c1559da0ca3640d5ae25e6e)]:
  - @mastra/auth-workos@1.6.4-alpha.1
  - @mastra/core@1.52.0-alpha.12
  - @mastra/code-sdk@1.0.0-alpha.14
  - @mastra/auth-studio@1.3.2-alpha.1
