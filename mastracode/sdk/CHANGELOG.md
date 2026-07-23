# @mastra/code-sdk

## 1.0.0

### Major Changes

- Replaced GitHub-specific Mastra Code session state with Factory project and linked-repository identities. This lets SDK consumers represent sessions independently of a source-control provider and select a repository explicitly when sandbox execution is required. ([#19849](https://github.com/mastra-ai/mastra/pull/19849))

  Updated Mastra Code onboarding to be Factory-first: create a Factory by name, then link repositories from your connected source-control installations in a separate step. A Factory is valid with zero linked repositories, and the Board, Metrics, and Audit pages stay available for any server-backed Factory. Factory pages keep project-scoped data separate from repository-scoped intake and provide a repository selector when a Factory has multiple linked repositories. Creating a Factory from a local folder remains available as a secondary option.

  **Before**

  ```ts
  const state = { githubProjectId: 'project-1', sandboxId, sandboxWorkdir };
  ```

  **After**

  ```ts
  const state = {
    factoryProjectId: 'factory-project-1',
    projectRepositoryId: 'project-repository-1',
    sandboxId,
    sandboxWorkdir,
  };
  ```

### Minor Changes

- Moved model packs in Mastra Code web to database-backed storage and refreshed the built-in packs. ([#19849](https://github.com/mastra-ai/mastra/pull/19849))

  **Model packs are now stored in the Factory database**

  When running with a Factory backend, custom model packs are saved in a new model-packs storage domain scoped to your organization instead of the local settings.json file. Local (non-tenant) mode keeps the file-backed behavior.

  **Pick from available models**

  The settings Model tab now loads the list of available models from a new /web/config/models endpoint, so the Factory default model picker and model pack editor only offer models you actually have credentials for. Model pickers are searchable comboboxes instead of plain dropdowns, and pack activation now resolves the correct scoped session so packs can be activated from settings.

  **Default packs updated to the latest model releases**

  - Anthropic: build and plan anthropic/claude-fable-5, fast anthropic/claude-haiku-4-5
  - OpenAI: build and plan openai/gpt-5.6
  - Observational memory default model is now google/gemini-3.5-flash

- Added a Factory default model for server-backed Factories in Mastra Code web. Set it in Settings under the Model tab and every factory run (like issue triage) starts on that model. The Model tab now also hosts model packs, replacing the separate Packs tab — packs stay session-scoped while the default model is stored on the Factory project itself. ([#19849](https://github.com/mastra-ai/mastra/pull/19849))

- Added an input processor extension for embedding surfaces while preserving Mastra Code's required processors. ([#19702](https://github.com/mastra-ai/mastra/pull/19702))

- Added support for injecting pre-built storage and vector store instances into Mastra Code. `MastraCodeConfig.storage` now accepts a `MastraCompositeStore` instance in addition to a storage config, and the new `MastraCodeConfig.vector` slot accepts a `MastraVector` instance. When an instance is provided it is used as-is — no connection test or LibSQL fallback — so hosted deployments can share a single Postgres connection pool between Mastra storage and application tables. ([#19623](https://github.com/mastra-ai/mastra/pull/19623))

  **Before**

  ```ts
  await createMastraCode({ storage: { backend: 'pg', connectionString } });
  ```

  **After**

  ```ts
  const storage = new PostgresStore({ id: 'code-storage', connectionString });
  const vector = new PgVector({ id: 'code-vectors', connectionString });
  await createMastraCode({ storage, vector });
  ```

- Add goal execution to the headless `runMC` API. Goal runs use the same GoalManager and system-reminder signal path as the TUI and resolve on terminal `goal_evaluation` events without manual continuation messages. ([#19441](https://github.com/mastra-ai/mastra/pull/19441))

  ```ts
  const run = runMC({
    controller,
    session,
    goal: {
      objective: 'Implement and verify the requested change',
      judgeModelId: 'openai/gpt-5-mini',
      maxRuns: 20,
    },
  });

  for await (const event of run) {
    console.log(event.type);
  }

  const result = await run.result;
  ```

- Add browser-based OAuth authentication for HTTP MCP servers to Mastra Code. ([#19467](https://github.com/mastra-ai/mastra/pull/19467))

  When an HTTP MCP server rejects a connection with an authorization error, the
  `/mcp` selector now shows a "needs auth" badge and an **Authenticate** action.
  Choosing it opens the provider's consent page in the browser and completes the
  OAuth 2.1 authorization-code flow (PKCE + Dynamic Client Registration) over a
  loopback callback server, persists the tokens, and reconnects — no manual
  configuration required for a bare `{ "url": ... }` server entry. A **Cancel
  authentication** action aborts an in-flight flow and returns the server to the
  needs-auth state.

  The server manager gains `authenticateServer(name)` and
  `cancelServerAuthentication(name)`, `McpServerStatus` gains an optional
  `needsAuth` flag, and the OAuth `redirectUrl` in MCP server config is now
  optional (it defaults to a stable loopback URL). The config also accepts
  `callbackPort` as a shorthand that synthesizes
  `http://localhost:<callbackPort>/callback`, the Claude Code / Codex
  convention, so configs written for those clients (like Slack's official MCP
  plugin config) work verbatim. `callbackPort` and `redirectUrl` are mutually
  exclusive.

  ```ts
  const server = manager.getServerStatuses().find(s => s.name === 'supabase');
  if (server?.needsAuth) {
    // Opens the consent page in the browser, completes the OAuth flow, and
    // resolves with the reconnected server status.
    const status = await manager.authenticateServer('supabase', {
      onAuthorizationUrl: url => openInBrowser(url),
    });
    console.log(status.connected);

    // Abort an abandoned browser flow and return the server to needs-auth:
    // await manager.cancelServerAuthentication('supabase')
  }
  ```

- Added step-based OAuth APIs for browser-driven provider sign-in and tenant-aware credential resolution. Hosted applications can now inject a credential store so each request resolves the caller's credentials without copying stored secrets into process environment variables. ([#19638](https://github.com/mastra-ai/mastra/pull/19638))

  ```ts
  import { startAnthropicLogin } from '@mastra/code-sdk/auth/providers/anthropic';

  const { url, verifier } = await startAnthropicLogin();
  ```

- Added access to the workspace resolved for an AgentController session. ([#19547](https://github.com/mastra-ai/mastra/pull/19547))

  Use the session-owned workspace when an operation must remain isolated to that session:

  ```ts
  const session = await controller.createSession({ resourceId, scope });
  const workspace = session.getWorkspace();
  ```

  Mastra Code workspace resolvers can now accept an isolated read-only skill extension:

  ```ts
  const workspace = await getDynamicWorkspace({
    requestContext,
    skillExtension: {
      id: 'review-skills',
      paths: ['/__review_skills__'],
      createSource: fallback => new ReviewSkillSource(fallback),
    },
  });
  ```

  This lets SDK consumers compose additional read-only skill roots into selected workspaces without changing the default workspace skill set.

### Patch Changes

- dependencies updates: ([#19611](https://github.com/mastra-ai/mastra/pull/19611))
  - Updated dependency [`ai@^6.0.225` ↗︎](https://www.npmjs.com/package/ai/v/6.0.225) (from `^6.0.224`, in `dependencies`)

- dependencies updates: ([#19813](https://github.com/mastra-ai/mastra/pull/19813))
  - Updated dependency [`@ai-sdk/amazon-bedrock@^3.0.107` ↗︎](https://www.npmjs.com/package/@ai-sdk/amazon-bedrock/v/3.0.107) (from `^3.0.105`, in `dependencies`)
  - Updated dependency [`@ai-sdk/anthropic@^3.0.98` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/3.0.98) (from `^3.0.96`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai@^3.0.86` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai/v/3.0.86) (from `^3.0.84`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai-compatible@^2.0.62` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai-compatible/v/2.0.62) (from `^2.0.59`, in `dependencies`)
  - Updated dependency [`ai@^6.0.230` ↗︎](https://www.npmjs.com/package/ai/v/6.0.230) (from `^6.0.225`, in `dependencies`)

- Added on-disk verification to the update utilities: `runUpdate` now returns the package manager's stderr, and the new `performUpdate` locates the running install, delegates the update to the tool that owns it (for example vite-plus), verifies the on-disk version when available, and reports when a readable installed version remains unchanged. ([#18792](https://github.com/mastra-ai/mastra/pull/18792))

- Fixed Moonshot AI API key resolution so keys saved via /api-keys (MOONSHOT_API_KEY) work when selecting moonshot models ([#19655](https://github.com/mastra-ai/mastra/pull/19655))

- Fixed provider request history repair so incompatible tool-call IDs are sanitized and retried instead of being blindly resent after a provider rejects the request ([#19969](https://github.com/mastra-ai/mastra/pull/19969))

- Fixed goal duration so it persists across pauses and process restarts. ([#19837](https://github.com/mastra-ai/mastra/pull/19837))

- Fixed session thread cloning failing with "Source thread not found" when the cached dynamic memory instance was bound to a previous storage instance. The memory cache is now scoped to the storage it was created with. ([#19969](https://github.com/mastra-ai/mastra/pull/19969))

- Fixed Mastra Code retries for EPIPE and closed provider connections. (#19691) ([#19692](https://github.com/mastra-ai/mastra/pull/19692))

- Fixed ACP clients dropping standalone signal messages such as system reminders and notification summaries, while preserving assistant text deltas across interleaved signals without inserting separators. ([#18783](https://github.com/mastra-ai/mastra/pull/18783))

- Added a session notification when a GitHub plugin is automatically updated to its latest version ([#19943](https://github.com/mastra-ai/mastra/pull/19943))

  ```ts
  const unsubscribe = pluginManager.onGithubPluginsUpdated(pluginNames => {
    console.log(`Updated plugins: ${pluginNames.join(', ')}`);
  });

  // Call during shutdown.
  unsubscribe();
  ```

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

- Fixed Amazon Bedrock prompt caching for long Mastra Code conversations. ([#19690](https://github.com/mastra-ai/mastra/pull/19690))

- Fixed a crash (`TypeError: Cannot read properties of undefined (reading 'includes')`) when a Mastra store instance is injected into the SDK from a project whose dependency graph contains duplicate copies of @mastra/core. Injected stores are now detected structurally instead of with `instanceof`, so stores built against a different core copy are recognized correctly instead of being mistaken for a storage config. ([#20030](https://github.com/mastra-ai/mastra/pull/20030))

- Updated dependencies [[`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`d7385ad`](https://github.com/mastra-ai/mastra/commit/d7385ad9e88f9e4f33d15c0ec0bfebedde0cbc2e), [`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`1426af2`](https://github.com/mastra-ai/mastra/commit/1426af24975879c000d13ac75673f630fcc970c1), [`a40adeb`](https://github.com/mastra-ai/mastra/commit/a40adeb222b961a56a58af56a106106525721b74), [`8a0d145`](https://github.com/mastra-ai/mastra/commit/8a0d145aadbdf7278665aceaaec364b35dd9bd94), [`bd2f1d2`](https://github.com/mastra-ai/mastra/commit/bd2f1d274d05e60e2366f005ea0d94d5cea0d5ff), [`e1f2fae`](https://github.com/mastra-ai/mastra/commit/e1f2faebaf048c3d4c2e2c01d293767c195d5794), [`63aa799`](https://github.com/mastra-ai/mastra/commit/63aa799c6b44eacc7806cda6846b7c5bbee06b37), [`b7e79c3`](https://github.com/mastra-ai/mastra/commit/b7e79c3c02ac5cd415db34ba0975ceafc1464333), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`c9e3521`](https://github.com/mastra-ai/mastra/commit/c9e3521628422db84e00a5ff1dea7426c8cce537), [`d2ff897`](https://github.com/mastra-ai/mastra/commit/d2ff8979d3069c6101108cdb7815792b0cc1c1b3), [`da009e1`](https://github.com/mastra-ai/mastra/commit/da009e1aacd89ed94b8d1b2af09c9d4fe7c4db49), [`3b77e77`](https://github.com/mastra-ai/mastra/commit/3b77e7704936522e4769d29de1b5ea6901f302bd), [`c7d30cd`](https://github.com/mastra-ai/mastra/commit/c7d30cd86009c407df91105591f03cd6e3d2854d), [`21a0eb8`](https://github.com/mastra-ai/mastra/commit/21a0eb86746ba0b703acea360d4f84c6a5a493f2), [`8b20926`](https://github.com/mastra-ai/mastra/commit/8b20926cd59e2ba3d66458e062fa0e6e2ada3e68), [`975295d`](https://github.com/mastra-ai/mastra/commit/975295d418552f0d46a59edfef4c3ee555f9930a), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`6b1bf3b`](https://github.com/mastra-ai/mastra/commit/6b1bf3b9494bd51aa8f654c68c9355d6046fa2a1), [`35c2181`](https://github.com/mastra-ai/mastra/commit/35c2181e6a50e47c90ba36260db7c9723d54696f), [`0a2c22c`](https://github.com/mastra-ai/mastra/commit/0a2c22c902604439ec490319e14c17f331e0c84c), [`4cfdd64`](https://github.com/mastra-ai/mastra/commit/4cfdd645794feaea0c4ea711e70ecdfbef0c5b8e), [`b75d749`](https://github.com/mastra-ai/mastra/commit/b75d749621ff5d17e86bcb4ee809d301fb4f7cf3), [`821648b`](https://github.com/mastra-ai/mastra/commit/821648bf2871ef840100c7bacbecf676010bd12a), [`de86fd7`](https://github.com/mastra-ai/mastra/commit/de86fd7119f0438381d1a642e3d258143c0b9c29), [`2745031`](https://github.com/mastra-ai/mastra/commit/2745031d1d4a4978f037092da371428c32e2842a), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`3a8024c`](https://github.com/mastra-ai/mastra/commit/3a8024ce615f8aa89479c0d71fe61d10bb0040be), [`35865a5`](https://github.com/mastra-ai/mastra/commit/35865a53e194aa9634d6a70a97010e7a6b9d58b1), [`8314e6d`](https://github.com/mastra-ai/mastra/commit/8314e6df597a8379b1f934ddf1120f51f8530ab3), [`74faf8b`](https://github.com/mastra-ai/mastra/commit/74faf8bd9c1018f2492653c06b1e25fc8300e9e6), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`70687f7`](https://github.com/mastra-ai/mastra/commit/70687f7e495a322a02070b4a67cb0c77a5ca91ec), [`1fadac4`](https://github.com/mastra-ai/mastra/commit/1fadac44537caeefe81f9f775ae2f2f3d94e9069), [`89da3cd`](https://github.com/mastra-ai/mastra/commit/89da3cd80c7c9936791ff0c31e244bcc41b0dd12), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`76b7181`](https://github.com/mastra-ai/mastra/commit/76b71810366e6d90b9d3973149d1c7ba3659ffb9), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9), [`970c032`](https://github.com/mastra-ai/mastra/commit/970c032502751ee5dd4d0b603331d9838cb538fc), [`6deac4a`](https://github.com/mastra-ai/mastra/commit/6deac4a520750d807a2154333bf1b91a2df958a5), [`792ec9a`](https://github.com/mastra-ai/mastra/commit/792ec9a0869bab8274cf5e0ed2840738737a1607), [`712b864`](https://github.com/mastra-ai/mastra/commit/712b864aa1ed12b14c54390ec17b69de163c37f7), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`0c0e8d7`](https://github.com/mastra-ai/mastra/commit/0c0e8d7becd4d1445c656b78d5d845f606c1ff9d), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`19881f5`](https://github.com/mastra-ai/mastra/commit/19881f5d6a09437cf5b947d2e8be3bd8745df767), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9), [`8f7a5de`](https://github.com/mastra-ai/mastra/commit/8f7a5dedc246cdc938bb65516703cf9b27b03756), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`90ed0d0`](https://github.com/mastra-ai/mastra/commit/90ed0d0ca8fce0e1fc751fba16b30a5c00bb3fd1), [`11f6cd9`](https://github.com/mastra-ai/mastra/commit/11f6cd96fe42582403416608beb212cc1a2cc79e), [`ef03c0c`](https://github.com/mastra-ai/mastra/commit/ef03c0cfc62367a458e4cc56462e2148b35681c5), [`4fb4d88`](https://github.com/mastra-ai/mastra/commit/4fb4d881bc107acee13890ad4d78661016c510ed), [`4e68363`](https://github.com/mastra-ai/mastra/commit/4e683634f94ebd062d26a3bb6093a8dfc7263d37), [`c328769`](https://github.com/mastra-ai/mastra/commit/c3287698ff8ef98dba86d415faa566fa3e5f4d56), [`9f7c67a`](https://github.com/mastra-ai/mastra/commit/9f7c67abeeb52c41c51a9b5edee60b62afe7cd8d), [`0c52047`](https://github.com/mastra-ai/mastra/commit/0c520470a4547666156b2f18eb794eb8bd2676c8), [`3b65e68`](https://github.com/mastra-ai/mastra/commit/3b65e68d7f1c771c7a70eea42d83fefdd28cad88), [`4eba27a`](https://github.com/mastra-ai/mastra/commit/4eba27adcf60f991df0e62f94b3e75b4e67f3b4b), [`c701be3`](https://github.com/mastra-ai/mastra/commit/c701be32d7d9aa94a66da8c6cc38dcac6856f464), [`db650ce`](https://github.com/mastra-ai/mastra/commit/db650ce490348914e85b93651d83acdf8f2a4c31), [`ec17152`](https://github.com/mastra-ai/mastra/commit/ec17152e7514b5fad37d6ed50f90a937b4bb87a2), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`6354eeb`](https://github.com/mastra-ai/mastra/commit/6354eeb32efa9f5f68f51dda394e90e2ee76f1fb), [`a8799bb`](https://github.com/mastra-ai/mastra/commit/a8799bb8e44f4a60d01e4e2acd3448ff80bf14f8), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`13d2d44`](https://github.com/mastra-ai/mastra/commit/13d2d4476d78ce1aaede10dc83fb64108c9b9d82), [`e3868e2`](https://github.com/mastra-ai/mastra/commit/e3868e22babfffd0133771669ca724501c2dd58e), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9), [`9251370`](https://github.com/mastra-ai/mastra/commit/9251370ad413af464aa22d7566338bec5613e8de), [`21a0eb8`](https://github.com/mastra-ai/mastra/commit/21a0eb86746ba0b703acea360d4f84c6a5a493f2), [`3491666`](https://github.com/mastra-ai/mastra/commit/34916663c4fdd43b48c21f4ab2d5fb6dcccc94f9), [`c0bec73`](https://github.com/mastra-ai/mastra/commit/c0bec732c93d1a22ae5e51ed66cf8cacca8bd6a6)]:
  - @mastra/core@1.52.0
  - @mastra/pg@1.17.0
  - @mastra/tavily@1.1.1
  - @mastra/libsql@1.17.0
  - @mastra/mcp@1.15.0
  - @mastra/observability@1.16.2
  - @mastra/memory@1.23.1
  - @mastra/stagehand@0.3.1

## 1.0.0-alpha.18

### Patch Changes

- Updated dependencies [[`8314e6d`](https://github.com/mastra-ai/mastra/commit/8314e6df597a8379b1f934ddf1120f51f8530ab3)]:
  - @mastra/mcp@1.15.0-alpha.1

## 1.0.0-alpha.17

### Patch Changes

- Fixed a crash (`TypeError: Cannot read properties of undefined (reading 'includes')`) when a Mastra store instance is injected into the SDK from a project whose dependency graph contains duplicate copies of @mastra/core. Injected stores are now detected structurally instead of with `instanceof`, so stores built against a different core copy are recognized correctly instead of being mistaken for a storage config. ([#20030](https://github.com/mastra-ai/mastra/pull/20030))

## 1.0.0-alpha.16

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

- Updated dependencies [[`90ed0d0`](https://github.com/mastra-ai/mastra/commit/90ed0d0ca8fce0e1fc751fba16b30a5c00bb3fd1)]:
  - @mastra/libsql@1.17.0-alpha.4
  - @mastra/pg@1.17.0-alpha.4
  - @mastra/core@1.52.0-alpha.13

## 1.0.0-alpha.15

### Patch Changes

- Fixed provider request history repair so incompatible tool-call IDs are sanitized and retried instead of being blindly resent after a provider rejects the request ([#19969](https://github.com/mastra-ai/mastra/pull/19969))

- Fixed session thread cloning failing with "Source thread not found" when the cached dynamic memory instance was bound to a previous storage instance. The memory cache is now scoped to the storage it was created with. ([#19969](https://github.com/mastra-ai/mastra/pull/19969))

- Fixed cloned session threads reading from a previous storage instance. The dynamic memory cache now invalidates when the storage or vector instance changes, so thread cloning always uses the current database. ([#19966](https://github.com/mastra-ai/mastra/pull/19966))

## 1.0.0-alpha.14

### Patch Changes

- Added a session notification when a GitHub plugin is automatically updated to its latest version ([#19943](https://github.com/mastra-ai/mastra/pull/19943))

  ```ts
  const unsubscribe = pluginManager.onGithubPluginsUpdated(pluginNames => {
    console.log(`Updated plugins: ${pluginNames.join(', ')}`);
  });

  // Call during shutdown.
  unsubscribe();
  ```

- Updated dependencies [[`d7385ad`](https://github.com/mastra-ai/mastra/commit/d7385ad9e88f9e4f33d15c0ec0bfebedde0cbc2e), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`35865a5`](https://github.com/mastra-ai/mastra/commit/35865a53e194aa9634d6a70a97010e7a6b9d58b1), [`70687f7`](https://github.com/mastra-ai/mastra/commit/70687f7e495a322a02070b4a67cb0c77a5ca91ec), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39)]:
  - @mastra/core@1.52.0-alpha.12

## 1.0.0-alpha.13

### Patch Changes

- Updated dependencies [[`c9e3521`](https://github.com/mastra-ai/mastra/commit/c9e3521628422db84e00a5ff1dea7426c8cce537)]:
  - @mastra/pg@1.17.0-alpha.3

## 1.0.0-alpha.12

### Minor Changes

- Added an input processor extension for embedding surfaces while preserving Mastra Code's required processors. ([#19702](https://github.com/mastra-ai/mastra/pull/19702))

### Patch Changes

- Improved local database safety by using rollback journals and closing storage during shutdown. ([#19901](https://github.com/mastra-ai/mastra/pull/19901))

- Updated dependencies [[`c7d30cd`](https://github.com/mastra-ai/mastra/commit/c7d30cd86009c407df91105591f03cd6e3d2854d), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`6193d6d`](https://github.com/mastra-ai/mastra/commit/6193d6d4ae62ad68daaaf450992198e9e49493f1), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`4e68363`](https://github.com/mastra-ai/mastra/commit/4e683634f94ebd062d26a3bb6093a8dfc7263d37), [`9251370`](https://github.com/mastra-ai/mastra/commit/9251370ad413af464aa22d7566338bec5613e8de)]:
  - @mastra/core@1.52.0-alpha.11
  - @mastra/libsql@1.17.0-alpha.3

## 1.0.0-alpha.11

### Minor Changes

- Add browser-based OAuth authentication for HTTP MCP servers to Mastra Code. ([#19467](https://github.com/mastra-ai/mastra/pull/19467))

  When an HTTP MCP server rejects a connection with an authorization error, the
  `/mcp` selector now shows a "needs auth" badge and an **Authenticate** action.
  Choosing it opens the provider's consent page in the browser and completes the
  OAuth 2.1 authorization-code flow (PKCE + Dynamic Client Registration) over a
  loopback callback server, persists the tokens, and reconnects — no manual
  configuration required for a bare `{ "url": ... }` server entry. A **Cancel
  authentication** action aborts an in-flight flow and returns the server to the
  needs-auth state.

  The server manager gains `authenticateServer(name)` and
  `cancelServerAuthentication(name)`, `McpServerStatus` gains an optional
  `needsAuth` flag, and the OAuth `redirectUrl` in MCP server config is now
  optional (it defaults to a stable loopback URL). The config also accepts
  `callbackPort` as a shorthand that synthesizes
  `http://localhost:<callbackPort>/callback`, the Claude Code / Codex
  convention, so configs written for those clients (like Slack's official MCP
  plugin config) work verbatim. `callbackPort` and `redirectUrl` are mutually
  exclusive.

  ```ts
  const server = manager.getServerStatuses().find(s => s.name === 'supabase');
  if (server?.needsAuth) {
    // Opens the consent page in the browser, completes the OAuth flow, and
    // resolves with the reconnected server status.
    const status = await manager.authenticateServer('supabase', {
      onAuthorizationUrl: url => openInBrowser(url),
    });
    console.log(status.connected);

    // Abort an abandoned browser flow and return the server to needs-auth:
    // await manager.cancelServerAuthentication('supabase')
  }
  ```

## 1.0.0-alpha.10

### Major Changes

- Replaced GitHub-specific Mastra Code session state with Factory project and linked-repository identities. This lets SDK consumers represent sessions independently of a source-control provider and select a repository explicitly when sandbox execution is required. ([#19849](https://github.com/mastra-ai/mastra/pull/19849))

  Updated Mastra Code onboarding to be Factory-first: create a Factory by name, then link repositories from your connected source-control installations in a separate step. A Factory is valid with zero linked repositories, and the Board, Metrics, and Audit pages stay available for any server-backed Factory. Factory pages keep project-scoped data separate from repository-scoped intake and provide a repository selector when a Factory has multiple linked repositories. Creating a Factory from a local folder remains available as a secondary option.

  **Before**

  ```ts
  const state = { githubProjectId: 'project-1', sandboxId, sandboxWorkdir };
  ```

  **After**

  ```ts
  const state = {
    factoryProjectId: 'factory-project-1',
    projectRepositoryId: 'project-repository-1',
    sandboxId,
    sandboxWorkdir,
  };
  ```

### Minor Changes

- Moved model packs in Mastra Code web to database-backed storage and refreshed the built-in packs. ([#19849](https://github.com/mastra-ai/mastra/pull/19849))

  **Model packs are now stored in the Factory database**

  When running with a Factory backend, custom model packs are saved in a new model-packs storage domain scoped to your organization instead of the local settings.json file. Local (non-tenant) mode keeps the file-backed behavior.

  **Pick from available models**

  The settings Model tab now loads the list of available models from a new /web/config/models endpoint, so the Factory default model picker and model pack editor only offer models you actually have credentials for. Model pickers are searchable comboboxes instead of plain dropdowns, and pack activation now resolves the correct scoped session so packs can be activated from settings.

  **Default packs updated to the latest model releases**

  - Anthropic: build and plan anthropic/claude-fable-5, fast anthropic/claude-haiku-4-5
  - OpenAI: build and plan openai/gpt-5.6
  - Observational memory default model is now google/gemini-3.5-flash

- Added a Factory default model for server-backed Factories in Mastra Code web. Set it in Settings under the Model tab and every factory run (like issue triage) starts on that model. The Model tab now also hosts model packs, replacing the separate Packs tab — packs stay session-scoped while the default model is stored on the Factory project itself. ([#19849](https://github.com/mastra-ai/mastra/pull/19849))

### Patch Changes

- dependencies updates: ([#19813](https://github.com/mastra-ai/mastra/pull/19813))
  - Updated dependency [`@ai-sdk/amazon-bedrock@^3.0.107` ↗︎](https://www.npmjs.com/package/@ai-sdk/amazon-bedrock/v/3.0.107) (from `^3.0.105`, in `dependencies`)
  - Updated dependency [`@ai-sdk/anthropic@^3.0.98` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/3.0.98) (from `^3.0.96`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai@^3.0.86` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai/v/3.0.86) (from `^3.0.84`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai-compatible@^2.0.62` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai-compatible/v/2.0.62) (from `^2.0.59`, in `dependencies`)
  - Updated dependency [`ai@^6.0.230` ↗︎](https://www.npmjs.com/package/ai/v/6.0.230) (from `^6.0.225`, in `dependencies`)

- Fixed goal duration so it persists across pauses and process restarts. ([#19837](https://github.com/mastra-ai/mastra/pull/19837))

- Updated dependencies [[`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`da009e1`](https://github.com/mastra-ai/mastra/commit/da009e1aacd89ed94b8d1b2af09c9d4fe7c4db49), [`35c2181`](https://github.com/mastra-ai/mastra/commit/35c2181e6a50e47c90ba36260db7c9723d54696f), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`6deac4a`](https://github.com/mastra-ai/mastra/commit/6deac4a520750d807a2154333bf1b91a2df958a5), [`c328769`](https://github.com/mastra-ai/mastra/commit/c3287698ff8ef98dba86d415faa566fa3e5f4d56), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`3491666`](https://github.com/mastra-ai/mastra/commit/34916663c4fdd43b48c21f4ab2d5fb6dcccc94f9)]:
  - @mastra/core@1.52.0-alpha.10
  - @mastra/libsql@1.17.0-alpha.2
  - @mastra/pg@1.17.0-alpha.2
  - @mastra/observability@1.16.2-alpha.1
  - @mastra/mcp@1.15.0-alpha.0

## 0.2.0-alpha.9

### Patch Changes

- Updated dependencies [[`0a2c22c`](https://github.com/mastra-ai/mastra/commit/0a2c22c902604439ec490319e14c17f331e0c84c), [`3a8024c`](https://github.com/mastra-ai/mastra/commit/3a8024ce615f8aa89479c0d71fe61d10bb0040be)]:
  - @mastra/core@1.52.0-alpha.9

## 0.2.0-alpha.8

### Patch Changes

- Updated dependencies [[`3b77e77`](https://github.com/mastra-ai/mastra/commit/3b77e7704936522e4769d29de1b5ea6901f302bd), [`6b1bf3b`](https://github.com/mastra-ai/mastra/commit/6b1bf3b9494bd51aa8f654c68c9355d6046fa2a1), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9)]:
  - @mastra/core@1.52.0-alpha.8
  - @mastra/pg@1.17.0-alpha.1
  - @mastra/libsql@1.17.0-alpha.1

## 0.2.0-alpha.7

### Patch Changes

- Fixed Mastra Code retries for EPIPE and closed provider connections. (#19691) ([#19692](https://github.com/mastra-ai/mastra/pull/19692))

- Fixed Amazon Bedrock prompt caching for long Mastra Code conversations. ([#19690](https://github.com/mastra-ai/mastra/pull/19690))

- Updated dependencies [[`b7e79c3`](https://github.com/mastra-ai/mastra/commit/b7e79c3c02ac5cd415db34ba0975ceafc1464333), [`b75d749`](https://github.com/mastra-ai/mastra/commit/b75d749621ff5d17e86bcb4ee809d301fb4f7cf3), [`a8799bb`](https://github.com/mastra-ai/mastra/commit/a8799bb8e44f4a60d01e4e2acd3448ff80bf14f8)]:
  - @mastra/core@1.52.0-alpha.7

## 0.2.0-alpha.6

### Patch Changes

- Fixed Moonshot AI API key resolution so keys saved via /api-keys (MOONSHOT_API_KEY) work when selecting moonshot models ([#19655](https://github.com/mastra-ai/mastra/pull/19655))

- Updated dependencies [[`a40adeb`](https://github.com/mastra-ai/mastra/commit/a40adeb222b961a56a58af56a106106525721b74), [`821648b`](https://github.com/mastra-ai/mastra/commit/821648bf2871ef840100c7bacbecf676010bd12a), [`11f6cd9`](https://github.com/mastra-ai/mastra/commit/11f6cd96fe42582403416608beb212cc1a2cc79e)]:
  - @mastra/core@1.52.0-alpha.6

## 0.2.0-alpha.5

### Minor Changes

- Added support for injecting pre-built storage and vector store instances into Mastra Code. `MastraCodeConfig.storage` now accepts a `MastraCompositeStore` instance in addition to a storage config, and the new `MastraCodeConfig.vector` slot accepts a `MastraVector` instance. When an instance is provided it is used as-is — no connection test or LibSQL fallback — so hosted deployments can share a single Postgres connection pool between Mastra storage and application tables. ([#19623](https://github.com/mastra-ai/mastra/pull/19623))

  **Before**

  ```ts
  await createMastraCode({ storage: { backend: 'pg', connectionString } });
  ```

  **After**

  ```ts
  const storage = new PostgresStore({ id: 'code-storage', connectionString });
  const vector = new PgVector({ id: 'code-vectors', connectionString });
  await createMastraCode({ storage, vector });
  ```

- Added step-based OAuth APIs for browser-driven provider sign-in and tenant-aware credential resolution. Hosted applications can now inject a credential store so each request resolves the caller's credentials without copying stored secrets into process environment variables. ([#19638](https://github.com/mastra-ai/mastra/pull/19638))

  ```ts
  import { startAnthropicLogin } from '@mastra/code-sdk/auth/providers/anthropic';

  const { url, verifier } = await startAnthropicLogin();
  ```

- Added access to the workspace resolved for an AgentController session. ([#19547](https://github.com/mastra-ai/mastra/pull/19547))

  Use the session-owned workspace when an operation must remain isolated to that session:

  ```ts
  const session = await controller.createSession({ resourceId, scope });
  const workspace = session.getWorkspace();
  ```

  Mastra Code workspace resolvers can now accept an isolated read-only skill extension:

  ```ts
  const workspace = await getDynamicWorkspace({
    requestContext,
    skillExtension: {
      id: 'review-skills',
      paths: ['/__review_skills__'],
      createSource: fallback => new ReviewSkillSource(fallback),
    },
  });
  ```

  This lets SDK consumers compose additional read-only skill roots into selected workspaces without changing the default workspace skill set.

### Patch Changes

- dependencies updates: ([#19611](https://github.com/mastra-ai/mastra/pull/19611))
  - Updated dependency [`ai@^6.0.225` ↗︎](https://www.npmjs.com/package/ai/v/6.0.225) (from `^6.0.224`, in `dependencies`)
- Updated dependencies [[`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`e1f2fae`](https://github.com/mastra-ai/mastra/commit/e1f2faebaf048c3d4c2e2c01d293767c195d5794), [`63aa799`](https://github.com/mastra-ai/mastra/commit/63aa799c6b44eacc7806cda6846b7c5bbee06b37), [`d2ff897`](https://github.com/mastra-ai/mastra/commit/d2ff8979d3069c6101108cdb7815792b0cc1c1b3), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`89da3cd`](https://github.com/mastra-ai/mastra/commit/89da3cd80c7c9936791ff0c31e244bcc41b0dd12), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`76b7181`](https://github.com/mastra-ai/mastra/commit/76b71810366e6d90b9d3973149d1c7ba3659ffb9), [`0c0e8d7`](https://github.com/mastra-ai/mastra/commit/0c0e8d7becd4d1445c656b78d5d845f606c1ff9d), [`9f7c67a`](https://github.com/mastra-ai/mastra/commit/9f7c67abeeb52c41c51a9b5edee60b62afe7cd8d), [`0c52047`](https://github.com/mastra-ai/mastra/commit/0c520470a4547666156b2f18eb794eb8bd2676c8), [`3b65e68`](https://github.com/mastra-ai/mastra/commit/3b65e68d7f1c771c7a70eea42d83fefdd28cad88), [`ec17152`](https://github.com/mastra-ai/mastra/commit/ec17152e7514b5fad37d6ed50f90a937b4bb87a2), [`e3868e2`](https://github.com/mastra-ai/mastra/commit/e3868e22babfffd0133771669ca724501c2dd58e)]:
  - @mastra/core@1.52.0-alpha.5
  - @mastra/tavily@1.1.1-alpha.0
  - @mastra/libsql@1.16.1-alpha.0
  - @mastra/memory@1.23.1-alpha.1
  - @mastra/observability@1.16.2-alpha.0
  - @mastra/mcp@1.15.0-alpha.0

## 0.2.0-alpha.4

### Patch Changes

- Added on-disk verification to the update utilities: `runUpdate` now returns the package manager's stderr, and the new `performUpdate` locates the running install, delegates the update to the tool that owns it (for example vite-plus), verifies the on-disk version when available, and reports when a readable installed version remains unchanged. ([#18792](https://github.com/mastra-ai/mastra/pull/18792))

- Updated dependencies [[`4cfdd64`](https://github.com/mastra-ai/mastra/commit/4cfdd645794feaea0c4ea711e70ecdfbef0c5b8e)]:
  - @mastra/core@1.52.0-alpha.4

## 0.2.0-alpha.3

### Patch Changes

- Fixed ACP clients dropping standalone signal messages such as system reminders and notification summaries, while preserving assistant text deltas across interleaved signals without inserting separators. ([#18783](https://github.com/mastra-ai/mastra/pull/18783))

- Updated dependencies [[`1426af2`](https://github.com/mastra-ai/mastra/commit/1426af24975879c000d13ac75673f630fcc970c1), [`975295d`](https://github.com/mastra-ai/mastra/commit/975295d418552f0d46a59edfef4c3ee555f9930a), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`19881f5`](https://github.com/mastra-ai/mastra/commit/19881f5d6a09437cf5b947d2e8be3bd8745df767), [`ef03c0c`](https://github.com/mastra-ai/mastra/commit/ef03c0cfc62367a458e4cc56462e2148b35681c5), [`4fb4d88`](https://github.com/mastra-ai/mastra/commit/4fb4d881bc107acee13890ad4d78661016c510ed), [`4eba27a`](https://github.com/mastra-ai/mastra/commit/4eba27adcf60f991df0e62f94b3e75b4e67f3b4b), [`c701be3`](https://github.com/mastra-ai/mastra/commit/c701be32d7d9aa94a66da8c6cc38dcac6856f464)]:
  - @mastra/core@1.52.0-alpha.3
  - @mastra/pg@1.16.1-alpha.0

## 0.2.0-alpha.2

### Minor Changes

- Add goal execution to the headless `runMC` API. Goal runs use the same GoalManager and system-reminder signal path as the TUI and resolve on terminal `goal_evaluation` events without manual continuation messages. ([#19441](https://github.com/mastra-ai/mastra/pull/19441))

  ```ts
  const run = runMC({
    controller,
    session,
    goal: {
      objective: 'Implement and verify the requested change',
      judgeModelId: 'openai/gpt-5-mini',
      maxRuns: 20,
    },
  });

  for await (const event of run) {
    console.log(event.type);
  }

  const result = await run.result;
  ```

### Patch Changes

- Updated dependencies [[`8b20926`](https://github.com/mastra-ai/mastra/commit/8b20926cd59e2ba3d66458e062fa0e6e2ada3e68), [`74faf8b`](https://github.com/mastra-ai/mastra/commit/74faf8bd9c1018f2492653c06b1e25fc8300e9e6), [`1fadac4`](https://github.com/mastra-ai/mastra/commit/1fadac44537caeefe81f9f775ae2f2f3d94e9069), [`970c032`](https://github.com/mastra-ai/mastra/commit/970c032502751ee5dd4d0b603331d9838cb538fc), [`792ec9a`](https://github.com/mastra-ai/mastra/commit/792ec9a0869bab8274cf5e0ed2840738737a1607), [`712b864`](https://github.com/mastra-ai/mastra/commit/712b864aa1ed12b14c54390ec17b69de163c37f7), [`8f7a5de`](https://github.com/mastra-ai/mastra/commit/8f7a5dedc246cdc938bb65516703cf9b27b03756), [`c0bec73`](https://github.com/mastra-ai/mastra/commit/c0bec732c93d1a22ae5e51ed66cf8cacca8bd6a6)]:
  - @mastra/core@1.52.0-alpha.2
  - @mastra/mcp@1.15.0-alpha.0

## 0.1.1-alpha.1

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.51.1-alpha.1

## 0.1.1-alpha.0

### Patch Changes

- Updated dependencies [[`8a0d145`](https://github.com/mastra-ai/mastra/commit/8a0d145aadbdf7278665aceaaec364b35dd9bd94), [`bd2f1d2`](https://github.com/mastra-ai/mastra/commit/bd2f1d274d05e60e2366f005ea0d94d5cea0d5ff), [`21a0eb8`](https://github.com/mastra-ai/mastra/commit/21a0eb86746ba0b703acea360d4f84c6a5a493f2), [`de86fd7`](https://github.com/mastra-ai/mastra/commit/de86fd7119f0438381d1a642e3d258143c0b9c29), [`2745031`](https://github.com/mastra-ai/mastra/commit/2745031d1d4a4978f037092da371428c32e2842a), [`db650ce`](https://github.com/mastra-ai/mastra/commit/db650ce490348914e85b93651d83acdf8f2a4c31), [`6354eeb`](https://github.com/mastra-ai/mastra/commit/6354eeb32efa9f5f68f51dda394e90e2ee76f1fb), [`13d2d44`](https://github.com/mastra-ai/mastra/commit/13d2d4476d78ce1aaede10dc83fb64108c9b9d82), [`21a0eb8`](https://github.com/mastra-ai/mastra/commit/21a0eb86746ba0b703acea360d4f84c6a5a493f2)]:
  - @mastra/core@1.51.1-alpha.0
  - @mastra/stagehand@0.3.1-alpha.0
  - @mastra/memory@1.23.1-alpha.0

## 0.1.0

### Minor Changes

- Added support for async `extraTools` providers in `MastraCodeConfig`. The `extraTools` option now accepts an async function that receives the request context, so tools can be resolved per session (for example, only exposing an integration tool when the current project has that integration connected). ([#19369](https://github.com/mastra-ai/mastra/pull/19369))

  ```ts
  const mastraCode = await createMastraCode({
    extraTools: async ({ requestContext }) => {
      const controller = requestContext.get('controller');
      if (!(await hasLinearConnection(controller?.resourceId))) return {};
      return { linear_get_issue: linearGetIssueTool };
    },
  });
  ```

- Added a post-tool observer for custom Mastra Code integrations to react to completed tool calls without replacing built-in tools. ([#19446](https://github.com/mastra-ai/mastra/pull/19446))

  ```ts
  await mountAgentControllerOnMastra({
    postToolObserver: ({ toolName, output }) => logToolResult(toolName, output),
  });
  ```

- Renamed the Gateway constants exported from `@mastra/code-sdk/onboarding/settings` and added `MastraCodeGateway.getMastraGatewayApiKey()` so they match the Gateway product name. The old constant and method names keep working as deprecated aliases, and the stored values are unchanged. ([#18691](https://github.com/mastra-ai/mastra/pull/18691))

  ```ts
  // Before
  import { MEMORY_GATEWAY_PROVIDER, MEMORY_GATEWAY_DEFAULT_URL } from '@mastra/code-sdk/onboarding/settings';

  // After
  import { MASTRA_GATEWAY_PROVIDER, MASTRA_GATEWAY_DEFAULT_URL } from '@mastra/code-sdk/onboarding/settings';
  ```

- Publish the Mastra Code agent core as `@mastra/code-sdk` (previously the internal `@internal/mastracode` package), so third parties can build their own UIs and surfaces on top of the Mastra Code coding agent. The `mastracode` CLI now consumes it as a regular runtime dependency instead of bundling it into its published output. ([#18986](https://github.com/mastra-ai/mastra/pull/18986))

- Improved GitHub plugin dependency installs by requiring exact pnpm versions and running them through Corepack, with an actionable setup error when Corepack is unavailable. ([#19288](https://github.com/mastra-ai/mastra/pull/19288))

### Patch Changes

- dependencies updates: ([#16699](https://github.com/mastra-ai/mastra/pull/16699))
  - Updated dependency [`@ai-sdk/amazon-bedrock@^3.0.105` ↗︎](https://www.npmjs.com/package/@ai-sdk/amazon-bedrock/v/3.0.105) (from `^3.0.102`, in `dependencies`)
  - Updated dependency [`@ai-sdk/anthropic@^3.0.92` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/3.0.92) (from `^3.0.82`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai@^3.0.80` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai/v/3.0.80) (from `^3.0.63`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai-compatible@^2.0.56` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai-compatible/v/2.0.56) (from `^2.0.47`, in `dependencies`)
  - Updated dependency [`ai@^6.0.219` ↗︎](https://www.npmjs.com/package/ai/v/6.0.219) (from `^6.0.176`, in `dependencies`)

- dependencies updates: ([#19385](https://github.com/mastra-ai/mastra/pull/19385))
  - Updated dependency [`@ai-sdk/anthropic@^3.0.96` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/3.0.96) (from `^3.0.92`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai@^3.0.84` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai/v/3.0.84) (from `^3.0.80`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai-compatible@^2.0.59` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai-compatible/v/2.0.59) (from `^2.0.56`, in `dependencies`)
  - Updated dependency [`ai@^6.0.224` ↗︎](https://www.npmjs.com/package/ai/v/6.0.224) (from `^6.0.219`, in `dependencies`)

- Fixed the server-owned Mastra instance created by prepareAgentControllerMount ignoring a configured PubSub. When you pass a distributed pubsub (for example Redis Streams) to the agent controller, the mounted Mastra now runs its event bus on the same transport, so streams, workflows, and signals work across multiple server processes. ([#19431](https://github.com/mastra-ai/mastra/pull/19431))

- Fixed secure discovery of symlinked custom commands and skills. ([#19279](https://github.com/mastra-ai/mastra/pull/19279))

- Removed invalid CommonJS export entries from @mastra/code-sdk so package resolution matches the published ESM output. ([#19127](https://github.com/mastra-ai/mastra/pull/19127))

- Added the authoritative session scope to agent controller request context for scoped session integrations. ([#19446](https://github.com/mastra-ai/mastra/pull/19446))

  ```ts
  const controllerContext = requestContext.get('controller');
  console.log(controllerContext?.scope);
  ```

- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`fe1bda0`](https://github.com/mastra-ai/mastra/commit/fe1bda06f6af92a694a51712db747cda1e7185f0), [`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`1ce5121`](https://github.com/mastra-ai/mastra/commit/1ce512155d122bb21f47d98383e82ffbf84b39e8), [`fb8aea3`](https://github.com/mastra-ai/mastra/commit/fb8aea384291e77311be3a64ee1717320d5c3c73), [`4adc391`](https://github.com/mastra-ai/mastra/commit/4adc3911075249c352bb4832d2471922826344de), [`a5c6337`](https://github.com/mastra-ai/mastra/commit/a5c6337d23c7686c81a32ce62f550f610543a240), [`031931a`](https://github.com/mastra-ai/mastra/commit/031931a715405fb90759b1903c9c25cbf05994af), [`3cfc47a`](https://github.com/mastra-ai/mastra/commit/3cfc47a6b89940aadd0f46fb01ae9624a73a865d), [`eb70da9`](https://github.com/mastra-ai/mastra/commit/eb70da98e1007b18e1463d75121bc07db55f8e09), [`2bb7817`](https://github.com/mastra-ai/mastra/commit/2bb78176112fde628483de2830528f7eee911e56), [`51d9870`](https://github.com/mastra-ai/mastra/commit/51d987032c689c2855374d0f244f5d654da809d1), [`5cab274`](https://github.com/mastra-ai/mastra/commit/5cab2744250e22d12fefa7b32637dce224233cee), [`7fa27d3`](https://github.com/mastra-ai/mastra/commit/7fa27d3b6f5ed68cd34e454a4d3ad9c482a0cfbc), [`8b97958`](https://github.com/mastra-ai/mastra/commit/8b979589f9aa59ba67cac565949475f2ffeb4ac3), [`8410541`](https://github.com/mastra-ai/mastra/commit/84105412c60ecd3bb33a9838146f59c4b588228f), [`a58dcbb`](https://github.com/mastra-ai/mastra/commit/a58dcbb546d7e1d65ebdc1f39e55f0908fcd9391), [`aa38805`](https://github.com/mastra-ai/mastra/commit/aa38805b878b827403be785eb90688d7172f5a40), [`153bd3b`](https://github.com/mastra-ai/mastra/commit/153bd3b396bdfed6b74cf43de12db8fd2d83c04a), [`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`e955965`](https://github.com/mastra-ai/mastra/commit/e955965dce575a903e37cf054d28ea99aa48785e), [`bc1121a`](https://github.com/mastra-ai/mastra/commit/bc1121a7bb98f7cd73e82e3a7913a667a9fa9911), [`2d22570`](https://github.com/mastra-ai/mastra/commit/2d22570c7dfdd02123d0ecc529efb05ccba2d9fc), [`07bb863`](https://github.com/mastra-ai/mastra/commit/07bb8631919c6f7cf377dccd45b096e0f17fbed0), [`171c3a2`](https://github.com/mastra-ai/mastra/commit/171c3a23f36199ad1354166fb515b22b57f310c2), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`01b338c`](https://github.com/mastra-ai/mastra/commit/01b338c56271f0219606710e3e8b26dee27ac6c2), [`bd4d720`](https://github.com/mastra-ai/mastra/commit/bd4d720458e42c49b6829c4662812332be32cfcf), [`aac3e5a`](https://github.com/mastra-ai/mastra/commit/aac3e5a098b08077c7d5020d782d6353b217797c), [`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`860ef7e`](https://github.com/mastra-ai/mastra/commit/860ef7e77d92b63469cbe5857aa1e626197e43e9), [`17e818c`](https://github.com/mastra-ai/mastra/commit/17e818c51a958ba90641b1a959dc38faf8c034e9), [`edce8d2`](https://github.com/mastra-ai/mastra/commit/edce8d2769f19e27a05737c627af2d765472a4f8), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`8b7361d`](https://github.com/mastra-ai/mastra/commit/8b7361d35de68b80d05d30a74e0c69e7218fd612), [`1d39058`](https://github.com/mastra-ai/mastra/commit/1d39058e548efd691799985d5c8af2737f1c3bd2), [`3927473`](https://github.com/mastra-ai/mastra/commit/392747323ddb10c643d12be7b9ae913159dfaeed), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`85fb642`](https://github.com/mastra-ai/mastra/commit/85fb642f4d112d0da9f39808617397f7e47fe622), [`6789ab4`](https://github.com/mastra-ai/mastra/commit/6789ab4191ddcd32a932898b360b191e80cee1a9), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`634caff`](https://github.com/mastra-ai/mastra/commit/634caff29a9200ad058b67d53f96d9e5832fb8a2), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`481c112`](https://github.com/mastra-ai/mastra/commit/481c1125b752489673ec671fcb7ca80f9c86ffb1), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3), [`2eb656e`](https://github.com/mastra-ai/mastra/commit/2eb656ecb64671d4a95e3c94bf507ce6a0ef9e3b), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5), [`177010f`](https://github.com/mastra-ai/mastra/commit/177010ff096d2e4b28d89803be5b1a4cad2a0d6b), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5), [`b486abf`](https://github.com/mastra-ai/mastra/commit/b486abfa2a7528c6f527e4015c819ea9fa54aaad), [`54a51e0`](https://github.com/mastra-ai/mastra/commit/54a51e0a484fe1ebad3fb1f7ef5282a075709eb7), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b), [`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6), [`1b6e676`](https://github.com/mastra-ai/mastra/commit/1b6e67613c2a019df5920d4273d79bed09555807), [`4ce0163`](https://github.com/mastra-ai/mastra/commit/4ce0163dc86e675a86809685c8ce6c49f1aeb87e), [`4378341`](https://github.com/mastra-ai/mastra/commit/43783412df5ea3dd35f5b1f6e4851e79c346fc89)]:
  - @mastra/core@1.51.0
  - @mastra/memory@1.23.0
  - @mastra/mcp@1.14.0
  - @mastra/schema-compat@1.3.4
  - @mastra/observability@1.16.1
  - @mastra/pg@1.16.0
  - @mastra/libsql@1.16.0

## 0.1.0-alpha.13

### Minor Changes

- Added a post-tool observer for custom Mastra Code integrations to react to completed tool calls without replacing built-in tools. ([#19446](https://github.com/mastra-ai/mastra/pull/19446))

  ```ts
  await mountAgentControllerOnMastra({
    postToolObserver: ({ toolName, output }) => logToolResult(toolName, output),
  });
  ```

### Patch Changes

- Added the authoritative session scope to agent controller request context for scoped session integrations. ([#19446](https://github.com/mastra-ai/mastra/pull/19446))

  ```ts
  const controllerContext = requestContext.get('controller');
  console.log(controllerContext?.scope);
  ```

- Updated dependencies [[`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5)]:
  - @mastra/core@1.51.0-alpha.13
  - @mastra/pg@1.16.0-alpha.0
  - @mastra/libsql@1.16.0-alpha.1

## 0.1.0-alpha.12

### Patch Changes

- Fixed the server-owned Mastra instance created by prepareAgentControllerMount ignoring a configured PubSub. When you pass a distributed pubsub (for example Redis Streams) to the agent controller, the mounted Mastra now runs its event bus on the same transport, so streams, workflows, and signals work across multiple server processes. ([#19431](https://github.com/mastra-ai/mastra/pull/19431))

- Updated dependencies [[`aa38805`](https://github.com/mastra-ai/mastra/commit/aa38805b878b827403be785eb90688d7172f5a40), [`2d22570`](https://github.com/mastra-ai/mastra/commit/2d22570c7dfdd02123d0ecc529efb05ccba2d9fc), [`4378341`](https://github.com/mastra-ai/mastra/commit/43783412df5ea3dd35f5b1f6e4851e79c346fc89)]:
  - @mastra/core@1.51.0-alpha.12

## 0.1.0-alpha.11

### Patch Changes

- Updated dependencies [[`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59)]:
  - @mastra/core@1.51.0-alpha.11

## 0.1.0-alpha.10

### Patch Changes

- Updated dependencies [[`4adc391`](https://github.com/mastra-ai/mastra/commit/4adc3911075249c352bb4832d2471922826344de), [`171c3a2`](https://github.com/mastra-ai/mastra/commit/171c3a23f36199ad1354166fb515b22b57f310c2), [`b486abf`](https://github.com/mastra-ai/mastra/commit/b486abfa2a7528c6f527e4015c819ea9fa54aaad)]:
  - @mastra/core@1.51.0-alpha.10
  - @mastra/schema-compat@1.3.4-alpha.2
  - @mastra/mcp@1.14.0-alpha.0
  - @mastra/memory@1.23.0-alpha.4

## 0.1.0-alpha.9

### Patch Changes

- Updated dependencies [[`edce8d2`](https://github.com/mastra-ai/mastra/commit/edce8d2769f19e27a05737c627af2d765472a4f8)]:
  - @mastra/core@1.51.0-alpha.9

## 0.1.0-alpha.8

### Minor Changes

- Added support for async `extraTools` providers in `MastraCodeConfig`. The `extraTools` option now accepts an async function that receives the request context, so tools can be resolved per session (for example, only exposing an integration tool when the current project has that integration connected). ([#19369](https://github.com/mastra-ai/mastra/pull/19369))

  ```ts
  const mastraCode = await createMastraCode({
    extraTools: async ({ requestContext }) => {
      const controller = requestContext.get('controller');
      if (!(await hasLinearConnection(controller?.resourceId))) return {};
      return { linear_get_issue: linearGetIssueTool };
    },
  });
  ```

### Patch Changes

- dependencies updates: ([#16699](https://github.com/mastra-ai/mastra/pull/16699))
  - Updated dependency [`@ai-sdk/amazon-bedrock@^3.0.105` ↗︎](https://www.npmjs.com/package/@ai-sdk/amazon-bedrock/v/3.0.105) (from `^3.0.102`, in `dependencies`)
  - Updated dependency [`@ai-sdk/anthropic@^3.0.92` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/3.0.92) (from `^3.0.82`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai@^3.0.80` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai/v/3.0.80) (from `^3.0.63`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai-compatible@^2.0.56` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai-compatible/v/2.0.56) (from `^2.0.47`, in `dependencies`)
  - Updated dependency [`ai@^6.0.219` ↗︎](https://www.npmjs.com/package/ai/v/6.0.219) (from `^6.0.176`, in `dependencies`)

- dependencies updates: ([#19385](https://github.com/mastra-ai/mastra/pull/19385))
  - Updated dependency [`@ai-sdk/anthropic@^3.0.96` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/3.0.96) (from `^3.0.92`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai@^3.0.84` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai/v/3.0.84) (from `^3.0.80`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai-compatible@^2.0.59` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai-compatible/v/2.0.59) (from `^2.0.56`, in `dependencies`)
  - Updated dependency [`ai@^6.0.224` ↗︎](https://www.npmjs.com/package/ai/v/6.0.224) (from `^6.0.219`, in `dependencies`)
- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b)]:
  - @mastra/core@1.51.0-alpha.8

## 0.1.0-alpha.7

### Minor Changes

- Renamed the Gateway constants exported from `@mastra/code-sdk/onboarding/settings` and added `MastraCodeGateway.getMastraGatewayApiKey()` so they match the Gateway product name. The old constant and method names keep working as deprecated aliases, and the stored values are unchanged. ([#18691](https://github.com/mastra-ai/mastra/pull/18691))

  ```ts
  // Before
  import { MEMORY_GATEWAY_PROVIDER, MEMORY_GATEWAY_DEFAULT_URL } from '@mastra/code-sdk/onboarding/settings';

  // After
  import { MASTRA_GATEWAY_PROVIDER, MASTRA_GATEWAY_DEFAULT_URL } from '@mastra/code-sdk/onboarding/settings';
  ```

- Improved GitHub plugin dependency installs by requiring exact pnpm versions and running them through Corepack, with an actionable setup error when Corepack is unavailable. ([#19288](https://github.com/mastra-ai/mastra/pull/19288))

### Patch Changes

- Fixed secure discovery of symlinked custom commands and skills. ([#19279](https://github.com/mastra-ai/mastra/pull/19279))

- Updated dependencies [[`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`1ce5121`](https://github.com/mastra-ai/mastra/commit/1ce512155d122bb21f47d98383e82ffbf84b39e8), [`3cfc47a`](https://github.com/mastra-ai/mastra/commit/3cfc47a6b89940aadd0f46fb01ae9624a73a865d), [`2bb7817`](https://github.com/mastra-ai/mastra/commit/2bb78176112fde628483de2830528f7eee911e56), [`51d9870`](https://github.com/mastra-ai/mastra/commit/51d987032c689c2855374d0f244f5d654da809d1), [`5cab274`](https://github.com/mastra-ai/mastra/commit/5cab2744250e22d12fefa7b32637dce224233cee), [`7fa27d3`](https://github.com/mastra-ai/mastra/commit/7fa27d3b6f5ed68cd34e454a4d3ad9c482a0cfbc), [`a58dcbb`](https://github.com/mastra-ai/mastra/commit/a58dcbb546d7e1d65ebdc1f39e55f0908fcd9391), [`153bd3b`](https://github.com/mastra-ai/mastra/commit/153bd3b396bdfed6b74cf43de12db8fd2d83c04a), [`07bb863`](https://github.com/mastra-ai/mastra/commit/07bb8631919c6f7cf377dccd45b096e0f17fbed0), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`3927473`](https://github.com/mastra-ai/mastra/commit/392747323ddb10c643d12be7b9ae913159dfaeed), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`634caff`](https://github.com/mastra-ai/mastra/commit/634caff29a9200ad058b67d53f96d9e5832fb8a2), [`2eb656e`](https://github.com/mastra-ai/mastra/commit/2eb656ecb64671d4a95e3c94bf507ce6a0ef9e3b), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669)]:
  - @mastra/core@1.51.0-alpha.7
  - @mastra/observability@1.16.1-alpha.1
  - @mastra/mcp@1.14.0-alpha.0

## 0.1.0-alpha.6

### Patch Changes

- Updated dependencies [[`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6)]:
  - @mastra/core@1.51.0-alpha.6

## 0.1.0-alpha.5

### Patch Changes

- Updated dependencies [[`fb8aea3`](https://github.com/mastra-ai/mastra/commit/fb8aea384291e77311be3a64ee1717320d5c3c73), [`bd4d720`](https://github.com/mastra-ai/mastra/commit/bd4d720458e42c49b6829c4662812332be32cfcf), [`4ce0163`](https://github.com/mastra-ai/mastra/commit/4ce0163dc86e675a86809685c8ce6c49f1aeb87e)]:
  - @mastra/core@1.51.0-alpha.5
  - @mastra/observability@1.16.1-alpha.0
  - @mastra/mcp@1.14.0-alpha.0

## 0.1.0-alpha.4

### Patch Changes

- Updated dependencies [[`a5c6337`](https://github.com/mastra-ai/mastra/commit/a5c6337d23c7686c81a32ce62f550f610543a240), [`031931a`](https://github.com/mastra-ai/mastra/commit/031931a715405fb90759b1903c9c25cbf05994af), [`eb70da9`](https://github.com/mastra-ai/mastra/commit/eb70da98e1007b18e1463d75121bc07db55f8e09), [`8b97958`](https://github.com/mastra-ai/mastra/commit/8b979589f9aa59ba67cac565949475f2ffeb4ac3), [`8410541`](https://github.com/mastra-ai/mastra/commit/84105412c60ecd3bb33a9838146f59c4b588228f), [`01b338c`](https://github.com/mastra-ai/mastra/commit/01b338c56271f0219606710e3e8b26dee27ac6c2), [`8b7361d`](https://github.com/mastra-ai/mastra/commit/8b7361d35de68b80d05d30a74e0c69e7218fd612), [`85fb642`](https://github.com/mastra-ai/mastra/commit/85fb642f4d112d0da9f39808617397f7e47fe622), [`481c112`](https://github.com/mastra-ai/mastra/commit/481c1125b752489673ec671fcb7ca80f9c86ffb1), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3)]:
  - @mastra/core@1.51.0-alpha.4
  - @mastra/memory@1.23.0-alpha.3
  - @mastra/mcp@1.14.0-alpha.0

## 0.1.0-alpha.3

### Patch Changes

- Updated dependencies [[`177010f`](https://github.com/mastra-ai/mastra/commit/177010ff096d2e4b28d89803be5b1a4cad2a0d6b), [`54a51e0`](https://github.com/mastra-ai/mastra/commit/54a51e0a484fe1ebad3fb1f7ef5282a075709eb7)]:
  - @mastra/core@1.51.0-alpha.3

## 0.1.0-alpha.2

### Patch Changes

- Updated dependencies [[`e955965`](https://github.com/mastra-ai/mastra/commit/e955965dce575a903e37cf054d28ea99aa48785e), [`bc1121a`](https://github.com/mastra-ai/mastra/commit/bc1121a7bb98f7cd73e82e3a7913a667a9fa9911), [`860ef7e`](https://github.com/mastra-ai/mastra/commit/860ef7e77d92b63469cbe5857aa1e626197e43e9), [`17e818c`](https://github.com/mastra-ai/mastra/commit/17e818c51a958ba90641b1a959dc38faf8c034e9), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`1d39058`](https://github.com/mastra-ai/mastra/commit/1d39058e548efd691799985d5c8af2737f1c3bd2)]:
  - @mastra/core@1.51.0-alpha.2
  - @mastra/schema-compat@1.3.4-alpha.1
  - @mastra/libsql@1.16.0-alpha.0
  - @mastra/mcp@1.13.1
  - @mastra/memory@1.23.0-alpha.2

## 0.1.0-alpha.1

### Patch Changes

- Updated dependencies [[`aac3e5a`](https://github.com/mastra-ai/mastra/commit/aac3e5a098b08077c7d5020d782d6353b217797c), [`1b6e676`](https://github.com/mastra-ai/mastra/commit/1b6e67613c2a019df5920d4273d79bed09555807)]:
  - @mastra/memory@1.23.0-alpha.1

## 0.1.0-alpha.0

### Minor Changes

- Publish the Mastra Code agent core as `@mastra/code-sdk` (previously the internal `@internal/mastracode` package), so third parties can build their own UIs and surfaces on top of the Mastra Code coding agent. The `mastracode` CLI now consumes it as a regular runtime dependency instead of bundling it into its published output. ([#18986](https://github.com/mastra-ai/mastra/pull/18986))

### Patch Changes

- Removed invalid CommonJS export entries from @mastra/code-sdk so package resolution matches the published ESM output. ([#19127](https://github.com/mastra-ai/mastra/pull/19127))

- Updated dependencies [[`6789ab4`](https://github.com/mastra-ai/mastra/commit/6789ab4191ddcd32a932898b360b191e80cee1a9)]:
  - @mastra/schema-compat@1.3.4-alpha.0
  - @mastra/core@1.50.2-alpha.1
  - @mastra/mcp@1.13.1
  - @mastra/memory@1.22.3-alpha.0
