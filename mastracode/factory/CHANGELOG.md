# @mastra/factory

## 0.2.0-alpha.0

### Minor Changes

- Added guided model-provider setup to Factory onboarding with a recommended default model and provider-specific observational-memory defaults. ([#20079](https://github.com/mastra-ai/mastra/pull/20079))

### Patch Changes

- Link Factory Review cards to their work item when a PR opens without recorded provenance. GitHub PR-opened ingress now falls back to matching the PR head branch against work item session branches, and Review intake records `headBranch`/`baseBranch` metadata so the board and session views can relate the cards. ([#20074](https://github.com/mastra-ai/mastra/pull/20074))

- Fixed board-started work sessions to use the Factory's default coding model and persisted observational-memory settings. ([#20081](https://github.com/mastra-ai/mastra/pull/20081))

- Restored observational-memory settings so Factory users can choose models and preferences before opening a chat session. ([#20079](https://github.com/mastra-ai/mastra/pull/20079))

- Updated dependencies [[`55adddf`](https://github.com/mastra-ai/mastra/commit/55adddfda2a170b00c112bf37d677e8ce5b65d5a)]:
  - @mastra/core@1.52.1-alpha.0
  - @mastra/code-sdk@1.0.1-alpha.0

## 0.1.0

### Minor Changes

- Move the Factory project CRUD and source-control connection routes into `@mastra/factory` as a `ProjectRoutes` class. The routes take their storage handles (`FactoryProjectsStorage`, `SourceControlStorage`), the allowed version-control integration ids, and a `RouteAuth` adapter at construction time, replacing the old `ProjectDomain` that resolved domains through the `FactoryStorage` registry. The now-unused `FactoryDomain` base class was removed from the web host. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the audit domain, agent git-action auditing, intake capabilities, and intake routes into `@mastra/factory`. `AuditDomain` now takes its storage handles (`AuditStorage`, `FactoryProjectsStorage`) and a `RouteAuth` adapter directly instead of resolving them through the factory storage registry, fans out to pluggable `AuditSink`s, and resolves agent tenants through an injected `agentTenant` callback. Intake routes ship as an `IntakeRoutes` class that calls `IntakeStorage` directly (the intermediate intake store module was removed). ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Added autonomous first-pass skills to the Software Factory. Work items now get an automatic investigation, planning, or review pass as soon as they enter the matching board column — no human input needed mid-run: ([#20058](https://github.com/mastra-ai/mastra/pull/20058))

  - **factory-triage** runs when an issue enters triage: it investigates the issue, diagnoses the root cause, and requests a move to planning (or done if the issue should be closed).
  - **factory-plan** runs when an item enters planning: it produces a phased implementation plan and requests a move to execute.
  - **factory-review** runs when a pull request enters review: it reviews the changes, posts a verdict, and requests completion.

  Instead of stopping to ask questions, the skills decide and record each decision as an assumption, batching assumptions and genuinely-human questions into one terminal handoff message. The superseded interactive skills (understand-issue, understand-pr) were removed.

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

- The Factory's default `publicUrl` is now `http://localhost:4111` (the Factory server, which serves both the UI and the API) instead of `http://localhost:5173`. Generated Factory projects now run from a single server, so OAuth callback URLs and auth redirects derived from `publicUrl` point at the right origin out of the box. If you serve the SPA from a separate origin (for example a Vite dev server on :5173), set `publicUrl` (or `MASTRACODE_PUBLIC_URL`) explicitly. ([#20036](https://github.com/mastra-ai/mastra/pull/20036))

- Factory board now picks up new GitHub/Linear intake automatically (gentle 30s poll) and refreshes work-item positions immediately when the tab regains focus, instead of requiring a manual page reload ([#20071](https://github.com/mastra-ai/mastra/pull/20071))

- Fixed GitHub PATs saved in Settings not taking effect for the gh CLI in already-running Factory sessions until the server was restarted ([#20069](https://github.com/mastra-ai/mastra/pull/20069))

- Forwarded closed Platform GitHub event-log deliveries into Factory governance before dispatching repository subscriptions, and kept default GitHub rules from auto-starting issues or pull requests created before the Factory. ([#19988](https://github.com/mastra-ai/mastra/pull/19988))

- Track per-stage automation in Factory metrics. Stage history now stamps the exiting actor (`exitedBy`) alongside the entering one, `isAutomationActor` classifies rules-engine, agent (`agent:*`), and webhook (`github:*`) actors as automation, and `computeFactoryMetrics` reports a `stageAutomation` breakdown per stage: how many passes were fully automated (entered and exited by automation on the first visit) and how those automated passes ended up (`done`, `canceled`, `reworked`, or still in flight). Adds the `canceled` terminal stage to the board vocabulary (`FACTORY_RULE_STAGES`) — a tracked non-completion that feeds neither throughput nor cycle time — and rewords organization-required errors to be auth-provider neutral. ([#19844](https://github.com/mastra-ai/mastra/pull/19844))

- Fixed @mastra/factory build output so published modules use explicit .js import extensions and resolve correctly under Node ESM ([#19954](https://github.com/mastra-ai/mastra/pull/19954))

- Deployed factories now authenticate API and Studio requests with the same provider, so Studio sessions work without extra configuration. ([#19966](https://github.com/mastra-ai/mastra/pull/19966))

- Fixed Factory metrics windowing to use inclusive UTC calendar days. Date-only `from`/`to` bounds now include both selected days, an item completing at the current instant is counted in today's throughput (previously it could be dropped on the window's exclusive edge), and `windowDays` reflects the number of gap-filled day buckets. Cards feed the source mix only when created inside the window. ([#19971](https://github.com/mastra-ai/mastra/pull/19971))

- Fixed duplicate repositories in Factory source control settings. ([#19971](https://github.com/mastra-ai/mastra/pull/19971))

- Move the API-surface assembler from mastracode/web into @mastra/factory as `routes/surface` — `assembleWebApiRoutes` is now `assembleFactoryApiRoutes` and `WebApiRoutesDeps` is now `FactoryApiRoutesDeps`. The module composes fs/config/oauth/skills/intake/work-item routes plus every registered integration's route surface (with disabled-status stubs for absent github/linear integrations) from explicitly threaded dependency handles. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the GitHub integration and the sandbox fleet into `@mastra/factory`. The fleet is now a DI-constructed `SandboxFleet` class (`@mastra/factory/sandbox/fleet`) that owns provisioning, reattach, teardown, idle windows, and per-replica budgets instead of reading a seeded runtime-config registry. The GitHub routes, webhook, sandbox materialization, project locks, and session subscriptions (`@mastra/factory/integrations/github`) resolve tenants through the `RouteAuth` seam and receive the fleet and factory storage via `IntegrationContext`, so the web host no longer exports `getSeededSandbox`/`getSeededGithubIntegration` service locators. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the filesystem routes (`@mastra/factory/routes/fs`) and skill routes (`@mastra/factory/routes/skills`) into `@mastra/factory`. The skill prepare/invoke routes are now a `SkillRoutes` class that resolves users and tenants through the `RouteAuth` seam instead of web-host auth helpers. Diagnostics fields exposed by the GitHub and Linear integrations rename `webAuthEnabled` to `factoryAuthEnabled` to match the package's auth seam naming. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Moved custom model providers and custom model packs off settings.json in the factory web app: both now live in the app database (org-scoped rows in deployed mode, a sentinel local scope in no-auth mode). Custom providers saved in the web settings page are picked up by model resolution and the model catalog through a new pluggable custom-providers source in the SDK, so the gateway no longer reads the host machine's settings.json for them, and models from your custom providers appear in the web model pickers. ([#19964](https://github.com/mastra-ai/mastra/pull/19964))

  Hosts that store custom providers elsewhere (like the factory's database) register a source at boot; when none is registered, the SDK keeps reading settings.json as before:

  ```ts
  import { setCustomProvidersSource } from '@mastra/code-sdk/agents/custom-provider-source';

  setCustomProvidersSource(tenant => (tenant ? snapshotForOrg(tenant.orgId) : []));
  ```

- Fixed cloned session threads reading from a previous storage instance. The dynamic memory cache now invalidates when the storage or vector instance changes, so thread cloning always uses the current database. ([#19966](https://github.com/mastra-ai/mastra/pull/19966))

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

- Move the Linear integration into `@mastra/factory/integrations/linear`. `LinearIntegration` now owns the full connection lifecycle (OAuth token exchange, single-flight refresh, scope checks, and connection caching) as class methods, the routes and agent tools resolve tenants through the `RouteAuth` seam instead of web-host auth imports, and the `getSeededIntegration` runtime-config indirection is gone — the host hands the integration instance and storage handles directly via `initialize()`. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Fixed Factory automation so polled GitHub events reach governance rules, authenticated sessions start with the correct ownership, and board moves reliably notify active or idle agents. ([#19979](https://github.com/mastra-ai/mastra/pull/19979))

- Move the `MastraFactory` assembly root into `@mastra/factory`. `factory-entry.ts` now lives at the package root export (`@mastra/factory`), alongside the extracted `workspace`, `spa-static`, `server-error`, and `sandbox/reattach` helpers. Factory skills ship with the package and are copied into deploy output via the consuming app's build script. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Fixed web chat sessions getting stuck in a "Connection lost — reconnecting…" loop while the session workspace was still starting up ([#20067](https://github.com/mastra-ai/mastra/pull/20067))

- Fixed a server startup crash when the factory's storage backend could not be recognized by the SDK. The factory now tells the SDK explicitly whether its Mastra store is Postgres or LibSQL, so agent state wiring works even when the project's dependency graph contains duplicate copies of Mastra packages. ([#20030](https://github.com/mastra-ai/mastra/pull/20030))

- Updated dependencies [[`a4d7c7d`](https://github.com/mastra-ai/mastra/commit/a4d7c7d74f423efc73b3e4db8142478763e6989d), [`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`d7385ad`](https://github.com/mastra-ai/mastra/commit/d7385ad9e88f9e4f33d15c0ec0bfebedde0cbc2e), [`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`1426af2`](https://github.com/mastra-ai/mastra/commit/1426af24975879c000d13ac75673f630fcc970c1), [`a40adeb`](https://github.com/mastra-ai/mastra/commit/a40adeb222b961a56a58af56a106106525721b74), [`8a0d145`](https://github.com/mastra-ai/mastra/commit/8a0d145aadbdf7278665aceaaec364b35dd9bd94), [`bd2f1d2`](https://github.com/mastra-ai/mastra/commit/bd2f1d274d05e60e2366f005ea0d94d5cea0d5ff), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`d2a51c1`](https://github.com/mastra-ai/mastra/commit/d2a51c13c92c22f82bba8b4f48e746a2cc1aecdf), [`e1f2fae`](https://github.com/mastra-ai/mastra/commit/e1f2faebaf048c3d4c2e2c01d293767c195d5794), [`63aa799`](https://github.com/mastra-ai/mastra/commit/63aa799c6b44eacc7806cda6846b7c5bbee06b37), [`b7e79c3`](https://github.com/mastra-ai/mastra/commit/b7e79c3c02ac5cd415db34ba0975ceafc1464333), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`55b6ecd`](https://github.com/mastra-ai/mastra/commit/55b6ecd1083d21d00ea19488e721e451de75e76f), [`dfc7769`](https://github.com/mastra-ai/mastra/commit/dfc77695549e4434873051ddd1f6065330ed5ab8), [`da009e1`](https://github.com/mastra-ai/mastra/commit/da009e1aacd89ed94b8d1b2af09c9d4fe7c4db49), [`3b77e77`](https://github.com/mastra-ai/mastra/commit/3b77e7704936522e4769d29de1b5ea6901f302bd), [`c7d30cd`](https://github.com/mastra-ai/mastra/commit/c7d30cd86009c407df91105591f03cd6e3d2854d), [`21a0eb8`](https://github.com/mastra-ai/mastra/commit/21a0eb86746ba0b703acea360d4f84c6a5a493f2), [`8b20926`](https://github.com/mastra-ai/mastra/commit/8b20926cd59e2ba3d66458e062fa0e6e2ada3e68), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`975295d`](https://github.com/mastra-ai/mastra/commit/975295d418552f0d46a59edfef4c3ee555f9930a), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`6b1bf3b`](https://github.com/mastra-ai/mastra/commit/6b1bf3b9494bd51aa8f654c68c9355d6046fa2a1), [`35c2181`](https://github.com/mastra-ai/mastra/commit/35c2181e6a50e47c90ba36260db7c9723d54696f), [`0a2c22c`](https://github.com/mastra-ai/mastra/commit/0a2c22c902604439ec490319e14c17f331e0c84c), [`cc656b9`](https://github.com/mastra-ai/mastra/commit/cc656b92cc8fe40af3e2ea8bb796a6b406e96791), [`4cfdd64`](https://github.com/mastra-ai/mastra/commit/4cfdd645794feaea0c4ea711e70ecdfbef0c5b8e), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`b75d749`](https://github.com/mastra-ai/mastra/commit/b75d749621ff5d17e86bcb4ee809d301fb4f7cf3), [`821648b`](https://github.com/mastra-ai/mastra/commit/821648bf2871ef840100c7bacbecf676010bd12a), [`de86fd7`](https://github.com/mastra-ai/mastra/commit/de86fd7119f0438381d1a642e3d258143c0b9c29), [`d2a51c1`](https://github.com/mastra-ai/mastra/commit/d2a51c13c92c22f82bba8b4f48e746a2cc1aecdf), [`2745031`](https://github.com/mastra-ai/mastra/commit/2745031d1d4a4978f037092da371428c32e2842a), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`cc656b9`](https://github.com/mastra-ai/mastra/commit/cc656b92cc8fe40af3e2ea8bb796a6b406e96791), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`3a8024c`](https://github.com/mastra-ai/mastra/commit/3a8024ce615f8aa89479c0d71fe61d10bb0040be), [`bb92559`](https://github.com/mastra-ai/mastra/commit/bb9255954be8323a5ecab7595fe5365c564b3f52), [`35865a5`](https://github.com/mastra-ai/mastra/commit/35865a53e194aa9634d6a70a97010e7a6b9d58b1), [`67dd8b5`](https://github.com/mastra-ai/mastra/commit/67dd8b594d8b87a3a4d4ca7659f57d89fe8312a6), [`f9717e4`](https://github.com/mastra-ai/mastra/commit/f9717e4a381500042d088577347a787b0ec8caff), [`74faf8b`](https://github.com/mastra-ai/mastra/commit/74faf8bd9c1018f2492653c06b1e25fc8300e9e6), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`70687f7`](https://github.com/mastra-ai/mastra/commit/70687f7e495a322a02070b4a67cb0c77a5ca91ec), [`1fadac4`](https://github.com/mastra-ai/mastra/commit/1fadac44537caeefe81f9f775ae2f2f3d94e9069), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`76b7181`](https://github.com/mastra-ai/mastra/commit/76b71810366e6d90b9d3973149d1c7ba3659ffb9), [`6341b72`](https://github.com/mastra-ai/mastra/commit/6341b720fa80e65731cbbd7d88d1088f4c5b9914), [`792ec9a`](https://github.com/mastra-ai/mastra/commit/792ec9a0869bab8274cf5e0ed2840738737a1607), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`712b864`](https://github.com/mastra-ai/mastra/commit/712b864aa1ed12b14c54390ec17b69de163c37f7), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`9bffb73`](https://github.com/mastra-ai/mastra/commit/9bffb73e9ea46f48b53205b35a69a57f70912c78), [`0c0e8d7`](https://github.com/mastra-ai/mastra/commit/0c0e8d7becd4d1445c656b78d5d845f606c1ff9d), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`eec6a54`](https://github.com/mastra-ai/mastra/commit/eec6a54c64cd365c9b75c14a02e32122ad5f657c), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9), [`8f7a5de`](https://github.com/mastra-ai/mastra/commit/8f7a5dedc246cdc938bb65516703cf9b27b03756), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`11f6cd9`](https://github.com/mastra-ai/mastra/commit/11f6cd96fe42582403416608beb212cc1a2cc79e), [`337d41d`](https://github.com/mastra-ai/mastra/commit/337d41d8aae0399d2bf42d42ebddac0c21953891), [`ef03c0c`](https://github.com/mastra-ai/mastra/commit/ef03c0cfc62367a458e4cc56462e2148b35681c5), [`4fb4d88`](https://github.com/mastra-ai/mastra/commit/4fb4d881bc107acee13890ad4d78661016c510ed), [`da009e1`](https://github.com/mastra-ai/mastra/commit/da009e1aacd89ed94b8d1b2af09c9d4fe7c4db49), [`4e68363`](https://github.com/mastra-ai/mastra/commit/4e683634f94ebd062d26a3bb6093a8dfc7263d37), [`c328769`](https://github.com/mastra-ai/mastra/commit/c3287698ff8ef98dba86d415faa566fa3e5f4d56), [`eec6a54`](https://github.com/mastra-ai/mastra/commit/eec6a54c64cd365c9b75c14a02e32122ad5f657c), [`d7f5f9e`](https://github.com/mastra-ai/mastra/commit/d7f5f9e5d76ed588842bce30fac076ec9e3ad98a), [`9f7c67a`](https://github.com/mastra-ai/mastra/commit/9f7c67abeeb52c41c51a9b5edee60b62afe7cd8d), [`c46bb46`](https://github.com/mastra-ai/mastra/commit/c46bb461636ce3a8d45ecd7fc5d4a58803360cd0), [`3b65e68`](https://github.com/mastra-ai/mastra/commit/3b65e68d7f1c771c7a70eea42d83fefdd28cad88), [`4eba27a`](https://github.com/mastra-ai/mastra/commit/4eba27adcf60f991df0e62f94b3e75b4e67f3b4b), [`c701be3`](https://github.com/mastra-ai/mastra/commit/c701be32d7d9aa94a66da8c6cc38dcac6856f464), [`db650ce`](https://github.com/mastra-ai/mastra/commit/db650ce490348914e85b93651d83acdf8f2a4c31), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`6354eeb`](https://github.com/mastra-ai/mastra/commit/6354eeb32efa9f5f68f51dda394e90e2ee76f1fb), [`a8799bb`](https://github.com/mastra-ai/mastra/commit/a8799bb8e44f4a60d01e4e2acd3448ff80bf14f8), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`e3868e2`](https://github.com/mastra-ai/mastra/commit/e3868e22babfffd0133771669ca724501c2dd58e), [`b06a569`](https://github.com/mastra-ai/mastra/commit/b06a56958d683e45574d2e3806dca42db5fe8a7a), [`9251370`](https://github.com/mastra-ai/mastra/commit/9251370ad413af464aa22d7566338bec5613e8de), [`b87e4ca`](https://github.com/mastra-ai/mastra/commit/b87e4cad9acf70e58c1559da0ca3640d5ae25e6e), [`3491666`](https://github.com/mastra-ai/mastra/commit/34916663c4fdd43b48c21f4ab2d5fb6dcccc94f9), [`c0bec73`](https://github.com/mastra-ai/mastra/commit/c0bec732c93d1a22ae5e51ed66cf8cacca8bd6a6)]:
  - @mastra/auth-workos@1.6.4
  - @mastra/code-sdk@1.0.0
  - @mastra/core@1.52.0
  - @mastra/auth-studio@1.3.2

## 0.1.0-alpha.10

### Patch Changes

- Factory board now picks up new GitHub/Linear intake automatically (gentle 30s poll) and refreshes work-item positions immediately when the tab regains focus, instead of requiring a manual page reload ([#20071](https://github.com/mastra-ai/mastra/pull/20071))

## 0.1.0-alpha.9

### Patch Changes

- Fixed GitHub PATs saved in Settings not taking effect for the gh CLI in already-running Factory sessions until the server was restarted ([#20069](https://github.com/mastra-ai/mastra/pull/20069))

- Fixed web chat sessions getting stuck in a "Connection lost — reconnecting…" loop while the session workspace was still starting up ([#20067](https://github.com/mastra-ai/mastra/pull/20067))

## 0.1.0-alpha.8

### Minor Changes

- Added autonomous first-pass skills to the Software Factory. Work items now get an automatic investigation, planning, or review pass as soon as they enter the matching board column — no human input needed mid-run: ([#20058](https://github.com/mastra-ai/mastra/pull/20058))

  - **factory-triage** runs when an issue enters triage: it investigates the issue, diagnoses the root cause, and requests a move to planning (or done if the issue should be closed).
  - **factory-plan** runs when an item enters planning: it produces a phased implementation plan and requests a move to execute.
  - **factory-review** runs when a pull request enters review: it reviews the changes, posts a verdict, and requests completion.

  Instead of stopping to ask questions, the skills decide and record each decision as an assumption, batching assumptions and genuinely-human questions into one terminal handoff message. The superseded interactive skills (understand-issue, understand-pr) were removed.

## 0.1.0-alpha.7

### Patch Changes

- Updated dependencies:
  - @mastra/code-sdk@1.0.0-alpha.18

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
