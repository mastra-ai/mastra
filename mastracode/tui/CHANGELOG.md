# mastracode

## 0.32.2-alpha.1

### Patch Changes

- Updated dependencies [[`c8d8a01`](https://github.com/mastra-ai/mastra/commit/c8d8a010ee2efe2b7bf4d07707382c34c87b14e4), [`371cf60`](https://github.com/mastra-ai/mastra/commit/371cf6075cef88ac6919a08d59a82e485397364a), [`263d2ca`](https://github.com/mastra-ai/mastra/commit/263d2cac80ba3b03b9c0f008db6f1f1b9eb0278c)]:
  - @mastra/core@1.53.0-alpha.1
  - @mastra/code-sdk@1.0.2-alpha.1

## 0.32.2-alpha.0

### Patch Changes

- Improved Factory board cards with hover-revealed thread actions, top-right action menus, correct workspace links, and impact-free same-column drops. ([#20095](https://github.com/mastra-ai/mastra/pull/20095))

- Fixed settings pages to use native page scrolling while keeping navigation visible. ([#20094](https://github.com/mastra-ai/mastra/pull/20094))

- Fixed Factory page loader hang after uninstalling the GitHub App. The source-control-connections endpoint now skips connections whose installation was pruned instead of 500-ing, so the UI hydrates and the user can re-link their repos through the normal flow. ([#20106](https://github.com/mastra-ai/mastra/pull/20106))

- Redesigned the Factory onboarding LLM step as a sign-in style screen. ([#20089](https://github.com/mastra-ai/mastra/pull/20089))

  - Providers with browser sign-in (Anthropic, OpenAI, GitHub Copilot, xAI) now appear as top-level buttons with their logos; clicking one starts sign-in directly.
  - An OR divider leads into a searchable API key provider list; results are capped in height and scroll, and picking an unconnected provider opens the API key dialog directly.
  - Once a provider is connected, the step focuses on choosing the Factory default model, with a full-width finish button and a Change provider option.

- Fixed local database corruption on exit by closing storage connections during TUI shutdown. The signal handler (SIGINT, SIGTERM, SIGHUP) now calls storage close, which checkpoints and truncates WAL files and switches back to DELETE journal mode before the process exits. Previously, abrupt termination left WAL sidecars un-checkpointed, which could corrupt the local SQLite database on the next open. ([#20110](https://github.com/mastra-ai/mastra/pull/20110))

- Improved MastraCode page layouts so reports use native scrolling and chat content fills the viewport without inherited padding. ([#20094](https://github.com/mastra-ai/mastra/pull/20094))

- Updated dependencies [[`df6a9ce`](https://github.com/mastra-ai/mastra/commit/df6a9ce87214f7aadb2edfe62f67605fe998a0a4), [`0f92ed4`](https://github.com/mastra-ai/mastra/commit/0f92ed4173a480f617c6a0af6d51af100b42bdfc), [`cadd3a2`](https://github.com/mastra-ai/mastra/commit/cadd3a276f8e0026e3c84cffe935538419cb890c)]:
  - @mastra/core@1.52.2-alpha.0
  - @mastra/libsql@1.17.1-alpha.0
  - @mastra/code-sdk@1.0.2-alpha.0

## 0.32.1

### Patch Changes

- Updated dependencies [[`55adddf`](https://github.com/mastra-ai/mastra/commit/55adddfda2a170b00c112bf37d677e8ce5b65d5a)]:
  - @mastra/core@1.52.1
  - @mastra/code-sdk@1.0.1

## 0.32.1-alpha.0

### Patch Changes

- Updated dependencies [[`55adddf`](https://github.com/mastra-ai/mastra/commit/55adddfda2a170b00c112bf37d677e8ce5b65d5a)]:
  - @mastra/core@1.52.1-alpha.0
  - @mastra/code-sdk@1.0.1-alpha.0

## 0.32.0

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

### Patch Changes

- Fixed Mastra Code repeatedly prompting users to install the version they already have. ([#19464](https://github.com/mastra-ai/mastra/pull/19464))

- Fixed goal judge results rendering more than once during live goal runs. ([#19613](https://github.com/mastra-ai/mastra/pull/19613))

- Fixed quiet-mode tool previews jumping during streamed updates. ([#19651](https://github.com/mastra-ai/mastra/pull/19651))

- dependencies updates: ([#19611](https://github.com/mastra-ai/mastra/pull/19611))
  - Updated dependency [`ai@^6.0.225` ↗︎](https://www.npmjs.com/package/ai/v/6.0.225) (from `^6.0.224`, in `dependencies`)

- dependencies updates: ([#19813](https://github.com/mastra-ai/mastra/pull/19813))
  - Updated dependency [`@ai-sdk/amazon-bedrock@^3.0.107` ↗︎](https://www.npmjs.com/package/@ai-sdk/amazon-bedrock/v/3.0.107) (from `^3.0.105`, in `dependencies`)
  - Updated dependency [`@ai-sdk/anthropic@^3.0.98` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/3.0.98) (from `^3.0.96`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai@^3.0.86` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai/v/3.0.86) (from `^3.0.84`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai-compatible@^2.0.62` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai-compatible/v/2.0.62) (from `^2.0.59`, in `dependencies`)
  - Updated dependency [`ai@^6.0.230` ↗︎](https://www.npmjs.com/package/ai/v/6.0.230) (from `^6.0.225`, in `dependencies`)

- Fixed the auto-updater falsely reporting success when the update landed somewhere the running binary doesn't use. Previously any exit code 0 from the package manager was treated as success, so if Mastra Code was installed by a different tool (for example via a wrapper that puts a shim on your PATH), `npm install -g` could update a copy you never run and Mastra Code would still tell you to restart onto the "new" version. ([#18792](https://github.com/mastra-ai/mastra/pull/18792))

  Mastra Code now verifies the install before and after updating when the install location and version are detectable:

  - Before installing, it checks that the running binary lives in the package manager's global directory when that directory can be determined. If it doesn't (for example when the install is managed by another tool), it skips the pointless install and tells you immediately which install to update instead.
  - When the install is owned by a tool it recognizes, it delegates the update to that tool: vite-plus installs are updated by running `vp install -g` for you, and Homebrew installs (under any prefix, including Linuxbrew) get the exact `brew upgrade mastracode` command to run.
  - On Windows, update commands now run through a shell so the package managers' `.cmd` shims launch correctly.
  - When the installed version is readable, it only reports "Updated" when the running binary changed to the target version.
  - If the package manager reports success but the running binary is unchanged, it tells you honestly that your installation is managed by another tool and to update it with that tool, instead of claiming success.
  - When an update fails, it now surfaces the package manager's error output so you can see the cause, rather than just "Auto-update failed".

- Merged the API Keys, Model, and Memory settings into a single Model page in the web UI, with provider sign-in and API key tabs. Adding or removing provider credentials now immediately updates the available models and model packs without a reload. ([#20047](https://github.com/mastra-ai/mastra/pull/20047))

- Added a session notification when a GitHub plugin is automatically updated to its latest version ([#19943](https://github.com/mastra-ai/mastra/pull/19943))

  ```ts
  const unsubscribe = pluginManager.onGithubPluginsUpdated(pluginNames => {
    console.log(`Updated plugins: ${pluginNames.join(', ')}`);
  });

  // Call during shutdown.
  unsubscribe();
  ```

- Fixed completed tools with explicit error state rendering as successful after message hydration. ([#18783](https://github.com/mastra-ai/mastra/pull/18783))

- Fixed delivered steer messages disappearing from the chat after replacing their pending state. ([#19613](https://github.com/mastra-ai/mastra/pull/19613))

- Fixed a stuck ask_user question box after the underlying run failed: the prompt is now dismissed automatically instead of accepting an answer that could never be delivered. ([#19444](https://github.com/mastra-ai/mastra/pull/19444))

- Preserved Mastra Code's displayed active goal time across pauses, approval waits, and thread reloads. ([#19837](https://github.com/mastra-ai/mastra/pull/19837))

- Updated dependencies [[`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`d7385ad`](https://github.com/mastra-ai/mastra/commit/d7385ad9e88f9e4f33d15c0ec0bfebedde0cbc2e), [`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`1426af2`](https://github.com/mastra-ai/mastra/commit/1426af24975879c000d13ac75673f630fcc970c1), [`a40adeb`](https://github.com/mastra-ai/mastra/commit/a40adeb222b961a56a58af56a106106525721b74), [`8a0d145`](https://github.com/mastra-ai/mastra/commit/8a0d145aadbdf7278665aceaaec364b35dd9bd94), [`bd2f1d2`](https://github.com/mastra-ai/mastra/commit/bd2f1d274d05e60e2366f005ea0d94d5cea0d5ff), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`e1f2fae`](https://github.com/mastra-ai/mastra/commit/e1f2faebaf048c3d4c2e2c01d293767c195d5794), [`63aa799`](https://github.com/mastra-ai/mastra/commit/63aa799c6b44eacc7806cda6846b7c5bbee06b37), [`b7e79c3`](https://github.com/mastra-ai/mastra/commit/b7e79c3c02ac5cd415db34ba0975ceafc1464333), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`55b6ecd`](https://github.com/mastra-ai/mastra/commit/55b6ecd1083d21d00ea19488e721e451de75e76f), [`dfc7769`](https://github.com/mastra-ai/mastra/commit/dfc77695549e4434873051ddd1f6065330ed5ab8), [`c9e3521`](https://github.com/mastra-ai/mastra/commit/c9e3521628422db84e00a5ff1dea7426c8cce537), [`d2ff897`](https://github.com/mastra-ai/mastra/commit/d2ff8979d3069c6101108cdb7815792b0cc1c1b3), [`da009e1`](https://github.com/mastra-ai/mastra/commit/da009e1aacd89ed94b8d1b2af09c9d4fe7c4db49), [`3b77e77`](https://github.com/mastra-ai/mastra/commit/3b77e7704936522e4769d29de1b5ea6901f302bd), [`c7d30cd`](https://github.com/mastra-ai/mastra/commit/c7d30cd86009c407df91105591f03cd6e3d2854d), [`21a0eb8`](https://github.com/mastra-ai/mastra/commit/21a0eb86746ba0b703acea360d4f84c6a5a493f2), [`8b20926`](https://github.com/mastra-ai/mastra/commit/8b20926cd59e2ba3d66458e062fa0e6e2ada3e68), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`975295d`](https://github.com/mastra-ai/mastra/commit/975295d418552f0d46a59edfef4c3ee555f9930a), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`6b1bf3b`](https://github.com/mastra-ai/mastra/commit/6b1bf3b9494bd51aa8f654c68c9355d6046fa2a1), [`35c2181`](https://github.com/mastra-ai/mastra/commit/35c2181e6a50e47c90ba36260db7c9723d54696f), [`0a2c22c`](https://github.com/mastra-ai/mastra/commit/0a2c22c902604439ec490319e14c17f331e0c84c), [`cc656b9`](https://github.com/mastra-ai/mastra/commit/cc656b92cc8fe40af3e2ea8bb796a6b406e96791), [`4cfdd64`](https://github.com/mastra-ai/mastra/commit/4cfdd645794feaea0c4ea711e70ecdfbef0c5b8e), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`b75d749`](https://github.com/mastra-ai/mastra/commit/b75d749621ff5d17e86bcb4ee809d301fb4f7cf3), [`821648b`](https://github.com/mastra-ai/mastra/commit/821648bf2871ef840100c7bacbecf676010bd12a), [`de86fd7`](https://github.com/mastra-ai/mastra/commit/de86fd7119f0438381d1a642e3d258143c0b9c29), [`2745031`](https://github.com/mastra-ai/mastra/commit/2745031d1d4a4978f037092da371428c32e2842a), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`cc656b9`](https://github.com/mastra-ai/mastra/commit/cc656b92cc8fe40af3e2ea8bb796a6b406e96791), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`3a8024c`](https://github.com/mastra-ai/mastra/commit/3a8024ce615f8aa89479c0d71fe61d10bb0040be), [`bb92559`](https://github.com/mastra-ai/mastra/commit/bb9255954be8323a5ecab7595fe5365c564b3f52), [`35865a5`](https://github.com/mastra-ai/mastra/commit/35865a53e194aa9634d6a70a97010e7a6b9d58b1), [`67dd8b5`](https://github.com/mastra-ai/mastra/commit/67dd8b594d8b87a3a4d4ca7659f57d89fe8312a6), [`8314e6d`](https://github.com/mastra-ai/mastra/commit/8314e6df597a8379b1f934ddf1120f51f8530ab3), [`f9717e4`](https://github.com/mastra-ai/mastra/commit/f9717e4a381500042d088577347a787b0ec8caff), [`74faf8b`](https://github.com/mastra-ai/mastra/commit/74faf8bd9c1018f2492653c06b1e25fc8300e9e6), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`70687f7`](https://github.com/mastra-ai/mastra/commit/70687f7e495a322a02070b4a67cb0c77a5ca91ec), [`1fadac4`](https://github.com/mastra-ai/mastra/commit/1fadac44537caeefe81f9f775ae2f2f3d94e9069), [`89da3cd`](https://github.com/mastra-ai/mastra/commit/89da3cd80c7c9936791ff0c31e244bcc41b0dd12), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`76b7181`](https://github.com/mastra-ai/mastra/commit/76b71810366e6d90b9d3973149d1c7ba3659ffb9), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9), [`6341b72`](https://github.com/mastra-ai/mastra/commit/6341b720fa80e65731cbbd7d88d1088f4c5b9914), [`970c032`](https://github.com/mastra-ai/mastra/commit/970c032502751ee5dd4d0b603331d9838cb538fc), [`6deac4a`](https://github.com/mastra-ai/mastra/commit/6deac4a520750d807a2154333bf1b91a2df958a5), [`792ec9a`](https://github.com/mastra-ai/mastra/commit/792ec9a0869bab8274cf5e0ed2840738737a1607), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`712b864`](https://github.com/mastra-ai/mastra/commit/712b864aa1ed12b14c54390ec17b69de163c37f7), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`9bffb73`](https://github.com/mastra-ai/mastra/commit/9bffb73e9ea46f48b53205b35a69a57f70912c78), [`0c0e8d7`](https://github.com/mastra-ai/mastra/commit/0c0e8d7becd4d1445c656b78d5d845f606c1ff9d), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`19881f5`](https://github.com/mastra-ai/mastra/commit/19881f5d6a09437cf5b947d2e8be3bd8745df767), [`eec6a54`](https://github.com/mastra-ai/mastra/commit/eec6a54c64cd365c9b75c14a02e32122ad5f657c), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9), [`8f7a5de`](https://github.com/mastra-ai/mastra/commit/8f7a5dedc246cdc938bb65516703cf9b27b03756), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`90ed0d0`](https://github.com/mastra-ai/mastra/commit/90ed0d0ca8fce0e1fc751fba16b30a5c00bb3fd1), [`11f6cd9`](https://github.com/mastra-ai/mastra/commit/11f6cd96fe42582403416608beb212cc1a2cc79e), [`337d41d`](https://github.com/mastra-ai/mastra/commit/337d41d8aae0399d2bf42d42ebddac0c21953891), [`ef03c0c`](https://github.com/mastra-ai/mastra/commit/ef03c0cfc62367a458e4cc56462e2148b35681c5), [`4fb4d88`](https://github.com/mastra-ai/mastra/commit/4fb4d881bc107acee13890ad4d78661016c510ed), [`4e68363`](https://github.com/mastra-ai/mastra/commit/4e683634f94ebd062d26a3bb6093a8dfc7263d37), [`c328769`](https://github.com/mastra-ai/mastra/commit/c3287698ff8ef98dba86d415faa566fa3e5f4d56), [`eec6a54`](https://github.com/mastra-ai/mastra/commit/eec6a54c64cd365c9b75c14a02e32122ad5f657c), [`d7f5f9e`](https://github.com/mastra-ai/mastra/commit/d7f5f9e5d76ed588842bce30fac076ec9e3ad98a), [`9f7c67a`](https://github.com/mastra-ai/mastra/commit/9f7c67abeeb52c41c51a9b5edee60b62afe7cd8d), [`c46bb46`](https://github.com/mastra-ai/mastra/commit/c46bb461636ce3a8d45ecd7fc5d4a58803360cd0), [`0c52047`](https://github.com/mastra-ai/mastra/commit/0c520470a4547666156b2f18eb794eb8bd2676c8), [`3b65e68`](https://github.com/mastra-ai/mastra/commit/3b65e68d7f1c771c7a70eea42d83fefdd28cad88), [`4eba27a`](https://github.com/mastra-ai/mastra/commit/4eba27adcf60f991df0e62f94b3e75b4e67f3b4b), [`c701be3`](https://github.com/mastra-ai/mastra/commit/c701be32d7d9aa94a66da8c6cc38dcac6856f464), [`db650ce`](https://github.com/mastra-ai/mastra/commit/db650ce490348914e85b93651d83acdf8f2a4c31), [`ec17152`](https://github.com/mastra-ai/mastra/commit/ec17152e7514b5fad37d6ed50f90a937b4bb87a2), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`6354eeb`](https://github.com/mastra-ai/mastra/commit/6354eeb32efa9f5f68f51dda394e90e2ee76f1fb), [`a8799bb`](https://github.com/mastra-ai/mastra/commit/a8799bb8e44f4a60d01e4e2acd3448ff80bf14f8), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`13d2d44`](https://github.com/mastra-ai/mastra/commit/13d2d4476d78ce1aaede10dc83fb64108c9b9d82), [`e3868e2`](https://github.com/mastra-ai/mastra/commit/e3868e22babfffd0133771669ca724501c2dd58e), [`b06a569`](https://github.com/mastra-ai/mastra/commit/b06a56958d683e45574d2e3806dca42db5fe8a7a), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9), [`9251370`](https://github.com/mastra-ai/mastra/commit/9251370ad413af464aa22d7566338bec5613e8de), [`21a0eb8`](https://github.com/mastra-ai/mastra/commit/21a0eb86746ba0b703acea360d4f84c6a5a493f2), [`3491666`](https://github.com/mastra-ai/mastra/commit/34916663c4fdd43b48c21f4ab2d5fb6dcccc94f9), [`c0bec73`](https://github.com/mastra-ai/mastra/commit/c0bec732c93d1a22ae5e51ed66cf8cacca8bd6a6)]:
  - @mastra/code-sdk@1.0.0
  - @mastra/core@1.52.0
  - @mastra/pg@1.17.0
  - @mastra/tavily@1.1.1
  - @mastra/libsql@1.17.0
  - @mastra/mcp@1.15.0
  - @mastra/observability@1.16.2
  - @mastra/memory@1.23.1
  - @mastra/stagehand@0.3.1

## 0.32.0-alpha.16

### Patch Changes

- Merged the API Keys, Model, and Memory settings into a single Model page in the web UI, with provider sign-in and API key tabs. Adding or removing provider credentials now immediately updates the available models and model packs without a reload. ([#20047](https://github.com/mastra-ai/mastra/pull/20047))

- Updated dependencies [[`8314e6d`](https://github.com/mastra-ai/mastra/commit/8314e6df597a8379b1f934ddf1120f51f8530ab3)]:
  - @mastra/mcp@1.15.0-alpha.1
  - @mastra/code-sdk@1.0.0-alpha.18

## 0.32.0-alpha.15

### Patch Changes

- Updated dependencies [[`eec6a54`](https://github.com/mastra-ai/mastra/commit/eec6a54c64cd365c9b75c14a02e32122ad5f657c), [`90ed0d0`](https://github.com/mastra-ai/mastra/commit/90ed0d0ca8fce0e1fc751fba16b30a5c00bb3fd1), [`eec6a54`](https://github.com/mastra-ai/mastra/commit/eec6a54c64cd365c9b75c14a02e32122ad5f657c)]:
  - @mastra/code-sdk@1.0.0-alpha.16
  - @mastra/libsql@1.17.0-alpha.4
  - @mastra/pg@1.17.0-alpha.4
  - @mastra/core@1.52.0-alpha.13

## 0.32.0-alpha.14

### Patch Changes

- Added a session notification when a GitHub plugin is automatically updated to its latest version ([#19943](https://github.com/mastra-ai/mastra/pull/19943))

  ```ts
  const unsubscribe = pluginManager.onGithubPluginsUpdated(pluginNames => {
    console.log(`Updated plugins: ${pluginNames.join(', ')}`);
  });

  // Call during shutdown.
  unsubscribe();
  ```

- Updated dependencies [[`d7385ad`](https://github.com/mastra-ai/mastra/commit/d7385ad9e88f9e4f33d15c0ec0bfebedde0cbc2e), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`35865a5`](https://github.com/mastra-ai/mastra/commit/35865a53e194aa9634d6a70a97010e7a6b9d58b1), [`70687f7`](https://github.com/mastra-ai/mastra/commit/70687f7e495a322a02070b4a67cb0c77a5ca91ec), [`9bffb73`](https://github.com/mastra-ai/mastra/commit/9bffb73e9ea46f48b53205b35a69a57f70912c78), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39)]:
  - @mastra/core@1.52.0-alpha.12
  - @mastra/code-sdk@1.0.0-alpha.14

## 0.32.0-alpha.13

### Patch Changes

- Updated dependencies [[`c9e3521`](https://github.com/mastra-ai/mastra/commit/c9e3521628422db84e00a5ff1dea7426c8cce537)]:
  - @mastra/pg@1.17.0-alpha.3
  - @mastra/code-sdk@1.0.0-alpha.13

## 0.32.0-alpha.12

### Patch Changes

- Fixed local database cleanup across interactive, ACP, and headless exits. ([#19901](https://github.com/mastra-ai/mastra/pull/19901))

- Updated dependencies [[`6193d6d`](https://github.com/mastra-ai/mastra/commit/6193d6d4ae62ad68daaaf450992198e9e49493f1), [`c7d30cd`](https://github.com/mastra-ai/mastra/commit/c7d30cd86009c407df91105591f03cd6e3d2854d), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`6193d6d`](https://github.com/mastra-ai/mastra/commit/6193d6d4ae62ad68daaaf450992198e9e49493f1), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`4e68363`](https://github.com/mastra-ai/mastra/commit/4e683634f94ebd062d26a3bb6093a8dfc7263d37), [`9251370`](https://github.com/mastra-ai/mastra/commit/9251370ad413af464aa22d7566338bec5613e8de)]:
  - @mastra/code-sdk@1.0.0-alpha.12
  - @mastra/core@1.52.0-alpha.11
  - @mastra/libsql@1.17.0-alpha.3

## 0.32.0-alpha.11

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

### Patch Changes

- Updated dependencies [[`6341b72`](https://github.com/mastra-ai/mastra/commit/6341b720fa80e65731cbbd7d88d1088f4c5b9914)]:
  - @mastra/code-sdk@1.0.0-alpha.11

## 0.31.1-alpha.10

### Patch Changes

- dependencies updates: ([#19813](https://github.com/mastra-ai/mastra/pull/19813))
  - Updated dependency [`@ai-sdk/amazon-bedrock@^3.0.107` ↗︎](https://www.npmjs.com/package/@ai-sdk/amazon-bedrock/v/3.0.107) (from `^3.0.105`, in `dependencies`)
  - Updated dependency [`@ai-sdk/anthropic@^3.0.98` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/3.0.98) (from `^3.0.96`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai@^3.0.86` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai/v/3.0.86) (from `^3.0.84`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai-compatible@^2.0.62` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai-compatible/v/2.0.62) (from `^2.0.59`, in `dependencies`)
  - Updated dependency [`ai@^6.0.230` ↗︎](https://www.npmjs.com/package/ai/v/6.0.230) (from `^6.0.225`, in `dependencies`)

- Preserved Mastra Code's displayed active goal time across pauses, approval waits, and thread reloads. ([#19837](https://github.com/mastra-ai/mastra/pull/19837))

- Updated dependencies [[`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`da009e1`](https://github.com/mastra-ai/mastra/commit/da009e1aacd89ed94b8d1b2af09c9d4fe7c4db49), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`35c2181`](https://github.com/mastra-ai/mastra/commit/35c2181e6a50e47c90ba36260db7c9723d54696f), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`6deac4a`](https://github.com/mastra-ai/mastra/commit/6deac4a520750d807a2154333bf1b91a2df958a5), [`c328769`](https://github.com/mastra-ai/mastra/commit/c3287698ff8ef98dba86d415faa566fa3e5f4d56), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`3491666`](https://github.com/mastra-ai/mastra/commit/34916663c4fdd43b48c21f4ab2d5fb6dcccc94f9)]:
  - @mastra/code-sdk@1.0.0-alpha.10
  - @mastra/core@1.52.0-alpha.10
  - @mastra/libsql@1.17.0-alpha.2
  - @mastra/pg@1.17.0-alpha.2
  - @mastra/observability@1.16.2-alpha.1
  - @mastra/mcp@1.15.0-alpha.0

## 0.31.1-alpha.9

### Patch Changes

- Updated dependencies [[`0a2c22c`](https://github.com/mastra-ai/mastra/commit/0a2c22c902604439ec490319e14c17f331e0c84c), [`3a8024c`](https://github.com/mastra-ai/mastra/commit/3a8024ce615f8aa89479c0d71fe61d10bb0040be)]:
  - @mastra/core@1.52.0-alpha.9
  - @mastra/code-sdk@0.2.0-alpha.9

## 0.31.1-alpha.8

### Patch Changes

- Updated dependencies [[`3b77e77`](https://github.com/mastra-ai/mastra/commit/3b77e7704936522e4769d29de1b5ea6901f302bd), [`6b1bf3b`](https://github.com/mastra-ai/mastra/commit/6b1bf3b9494bd51aa8f654c68c9355d6046fa2a1), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9)]:
  - @mastra/core@1.52.0-alpha.8
  - @mastra/pg@1.17.0-alpha.1
  - @mastra/libsql@1.17.0-alpha.1
  - @mastra/code-sdk@0.2.0-alpha.8

## 0.31.1-alpha.7

### Patch Changes

- Updated dependencies [[`b7e79c3`](https://github.com/mastra-ai/mastra/commit/b7e79c3c02ac5cd415db34ba0975ceafc1464333), [`b75d749`](https://github.com/mastra-ai/mastra/commit/b75d749621ff5d17e86bcb4ee809d301fb4f7cf3), [`67dd8b5`](https://github.com/mastra-ai/mastra/commit/67dd8b594d8b87a3a4d4ca7659f57d89fe8312a6), [`c46bb46`](https://github.com/mastra-ai/mastra/commit/c46bb461636ce3a8d45ecd7fc5d4a58803360cd0), [`a8799bb`](https://github.com/mastra-ai/mastra/commit/a8799bb8e44f4a60d01e4e2acd3448ff80bf14f8)]:
  - @mastra/core@1.52.0-alpha.7
  - @mastra/code-sdk@0.2.0-alpha.7

## 0.31.1-alpha.6

### Patch Changes

- Fixed quiet-mode tool previews jumping during streamed updates. ([#19651](https://github.com/mastra-ai/mastra/pull/19651))

- Updated dependencies [[`a40adeb`](https://github.com/mastra-ai/mastra/commit/a40adeb222b961a56a58af56a106106525721b74), [`dfc7769`](https://github.com/mastra-ai/mastra/commit/dfc77695549e4434873051ddd1f6065330ed5ab8), [`821648b`](https://github.com/mastra-ai/mastra/commit/821648bf2871ef840100c7bacbecf676010bd12a), [`11f6cd9`](https://github.com/mastra-ai/mastra/commit/11f6cd96fe42582403416608beb212cc1a2cc79e)]:
  - @mastra/core@1.52.0-alpha.6
  - @mastra/code-sdk@0.2.0-alpha.6

## 0.31.1-alpha.5

### Patch Changes

- Fixed goal judge results rendering more than once during live goal runs. ([#19613](https://github.com/mastra-ai/mastra/pull/19613))

- dependencies updates: ([#19611](https://github.com/mastra-ai/mastra/pull/19611))
  - Updated dependency [`ai@^6.0.225` ↗︎](https://www.npmjs.com/package/ai/v/6.0.225) (from `^6.0.224`, in `dependencies`)

- Fixed delivered steer messages disappearing from the chat after replacing their pending state. ([#19613](https://github.com/mastra-ai/mastra/pull/19613))

- Updated dependencies [[`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`e1f2fae`](https://github.com/mastra-ai/mastra/commit/e1f2faebaf048c3d4c2e2c01d293767c195d5794), [`63aa799`](https://github.com/mastra-ai/mastra/commit/63aa799c6b44eacc7806cda6846b7c5bbee06b37), [`d2ff897`](https://github.com/mastra-ai/mastra/commit/d2ff8979d3069c6101108cdb7815792b0cc1c1b3), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`bb92559`](https://github.com/mastra-ai/mastra/commit/bb9255954be8323a5ecab7595fe5365c564b3f52), [`89da3cd`](https://github.com/mastra-ai/mastra/commit/89da3cd80c7c9936791ff0c31e244bcc41b0dd12), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`76b7181`](https://github.com/mastra-ai/mastra/commit/76b71810366e6d90b9d3973149d1c7ba3659ffb9), [`0c0e8d7`](https://github.com/mastra-ai/mastra/commit/0c0e8d7becd4d1445c656b78d5d845f606c1ff9d), [`d7f5f9e`](https://github.com/mastra-ai/mastra/commit/d7f5f9e5d76ed588842bce30fac076ec9e3ad98a), [`9f7c67a`](https://github.com/mastra-ai/mastra/commit/9f7c67abeeb52c41c51a9b5edee60b62afe7cd8d), [`0c52047`](https://github.com/mastra-ai/mastra/commit/0c520470a4547666156b2f18eb794eb8bd2676c8), [`3b65e68`](https://github.com/mastra-ai/mastra/commit/3b65e68d7f1c771c7a70eea42d83fefdd28cad88), [`ec17152`](https://github.com/mastra-ai/mastra/commit/ec17152e7514b5fad37d6ed50f90a937b4bb87a2), [`e3868e2`](https://github.com/mastra-ai/mastra/commit/e3868e22babfffd0133771669ca724501c2dd58e)]:
  - @mastra/code-sdk@0.2.0-alpha.5
  - @mastra/core@1.52.0-alpha.5
  - @mastra/tavily@1.1.1-alpha.0
  - @mastra/libsql@1.16.1-alpha.0
  - @mastra/memory@1.23.1-alpha.1
  - @mastra/observability@1.16.2-alpha.0
  - @mastra/mcp@1.15.0-alpha.0

## 0.31.1-alpha.4

### Patch Changes

- Fixed the auto-updater falsely reporting success when the update landed somewhere the running binary doesn't use. Previously any exit code 0 from the package manager was treated as success, so if Mastra Code was installed by a different tool (for example via a wrapper that puts a shim on your PATH), `npm install -g` could update a copy you never run and Mastra Code would still tell you to restart onto the "new" version. ([#18792](https://github.com/mastra-ai/mastra/pull/18792))

  Mastra Code now verifies the install before and after updating when the install location and version are detectable:
  - Before installing, it checks that the running binary lives in the package manager's global directory when that directory can be determined. If it doesn't (for example when the install is managed by another tool), it skips the pointless install and tells you immediately which install to update instead.
  - When the install is owned by a tool it recognizes, it delegates the update to that tool: vite-plus installs are updated by running `vp install -g` for you, and Homebrew installs (under any prefix, including Linuxbrew) get the exact `brew upgrade mastracode` command to run.
  - On Windows, update commands now run through a shell so the package managers' `.cmd` shims launch correctly.
  - When the installed version is readable, it only reports "Updated" when the running binary changed to the target version.
  - If the package manager reports success but the running binary is unchanged, it tells you honestly that your installation is managed by another tool and to update it with that tool, instead of claiming success.
  - When an update fails, it now surfaces the package manager's error output so you can see the cause, rather than just "Auto-update failed".

- Updated dependencies [[`55b6ecd`](https://github.com/mastra-ai/mastra/commit/55b6ecd1083d21d00ea19488e721e451de75e76f), [`4cfdd64`](https://github.com/mastra-ai/mastra/commit/4cfdd645794feaea0c4ea711e70ecdfbef0c5b8e)]:
  - @mastra/code-sdk@0.2.0-alpha.4
  - @mastra/core@1.52.0-alpha.4

## 0.31.1-alpha.3

### Patch Changes

- Fixed completed tools with explicit error state rendering as successful after message hydration. ([#18783](https://github.com/mastra-ai/mastra/pull/18783))

- Updated dependencies [[`1426af2`](https://github.com/mastra-ai/mastra/commit/1426af24975879c000d13ac75673f630fcc970c1), [`975295d`](https://github.com/mastra-ai/mastra/commit/975295d418552f0d46a59edfef4c3ee555f9930a), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`19881f5`](https://github.com/mastra-ai/mastra/commit/19881f5d6a09437cf5b947d2e8be3bd8745df767), [`ef03c0c`](https://github.com/mastra-ai/mastra/commit/ef03c0cfc62367a458e4cc56462e2148b35681c5), [`4fb4d88`](https://github.com/mastra-ai/mastra/commit/4fb4d881bc107acee13890ad4d78661016c510ed), [`4eba27a`](https://github.com/mastra-ai/mastra/commit/4eba27adcf60f991df0e62f94b3e75b4e67f3b4b), [`c701be3`](https://github.com/mastra-ai/mastra/commit/c701be32d7d9aa94a66da8c6cc38dcac6856f464)]:
  - @mastra/core@1.52.0-alpha.3
  - @mastra/code-sdk@0.2.0-alpha.3
  - @mastra/pg@1.16.1-alpha.0

## 0.31.1-alpha.2

### Patch Changes

- Fixed a stuck ask_user question box after the underlying run failed: the prompt is now dismissed automatically instead of accepting an answer that could never be delivered. ([#19444](https://github.com/mastra-ai/mastra/pull/19444))

- Updated dependencies [[`8b20926`](https://github.com/mastra-ai/mastra/commit/8b20926cd59e2ba3d66458e062fa0e6e2ada3e68), [`f9717e4`](https://github.com/mastra-ai/mastra/commit/f9717e4a381500042d088577347a787b0ec8caff), [`74faf8b`](https://github.com/mastra-ai/mastra/commit/74faf8bd9c1018f2492653c06b1e25fc8300e9e6), [`1fadac4`](https://github.com/mastra-ai/mastra/commit/1fadac44537caeefe81f9f775ae2f2f3d94e9069), [`970c032`](https://github.com/mastra-ai/mastra/commit/970c032502751ee5dd4d0b603331d9838cb538fc), [`792ec9a`](https://github.com/mastra-ai/mastra/commit/792ec9a0869bab8274cf5e0ed2840738737a1607), [`712b864`](https://github.com/mastra-ai/mastra/commit/712b864aa1ed12b14c54390ec17b69de163c37f7), [`8f7a5de`](https://github.com/mastra-ai/mastra/commit/8f7a5dedc246cdc938bb65516703cf9b27b03756), [`c0bec73`](https://github.com/mastra-ai/mastra/commit/c0bec732c93d1a22ae5e51ed66cf8cacca8bd6a6)]:
  - @mastra/core@1.52.0-alpha.2
  - @mastra/code-sdk@0.2.0-alpha.2
  - @mastra/mcp@1.15.0-alpha.0

## 0.31.1-alpha.1

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.51.1-alpha.1
  - @mastra/code-sdk@0.1.1-alpha.1

## 0.31.1-alpha.0

### Patch Changes

- Fixed Mastra Code repeatedly prompting users to install the version they already have. ([#19464](https://github.com/mastra-ai/mastra/pull/19464))

- Updated dependencies [[`8a0d145`](https://github.com/mastra-ai/mastra/commit/8a0d145aadbdf7278665aceaaec364b35dd9bd94), [`bd2f1d2`](https://github.com/mastra-ai/mastra/commit/bd2f1d274d05e60e2366f005ea0d94d5cea0d5ff), [`21a0eb8`](https://github.com/mastra-ai/mastra/commit/21a0eb86746ba0b703acea360d4f84c6a5a493f2), [`de86fd7`](https://github.com/mastra-ai/mastra/commit/de86fd7119f0438381d1a642e3d258143c0b9c29), [`2745031`](https://github.com/mastra-ai/mastra/commit/2745031d1d4a4978f037092da371428c32e2842a), [`db650ce`](https://github.com/mastra-ai/mastra/commit/db650ce490348914e85b93651d83acdf8f2a4c31), [`6354eeb`](https://github.com/mastra-ai/mastra/commit/6354eeb32efa9f5f68f51dda394e90e2ee76f1fb), [`13d2d44`](https://github.com/mastra-ai/mastra/commit/13d2d4476d78ce1aaede10dc83fb64108c9b9d82), [`21a0eb8`](https://github.com/mastra-ai/mastra/commit/21a0eb86746ba0b703acea360d4f84c6a5a493f2)]:
  - @mastra/core@1.51.1-alpha.0
  - @mastra/stagehand@0.3.1-alpha.0
  - @mastra/memory@1.23.1-alpha.0
  - @mastra/code-sdk@0.1.1-alpha.0

## 0.31.0

### Minor Changes

- Added storage retention and a new `/prune` command to keep the local database from growing without bound. ([#19059](https://github.com/mastra-ai/mastra/pull/19059))

  **Default retention policies** are now applied to Mastra Code storage: chat messages and threads are kept for 90 days, observability spans and logs for 14 days, scores and workflow snapshots for 30 days. Rows older than these limits are only removed when you run `/prune` — nothing is deleted automatically.

  **New `/prune` command:**
  - `/prune` closes the TUI, hands the terminal over to a maintenance run that deletes rows older than the retention policies with live progress output, then exits (start `mastracode` again for a new session)
  - `/prune vacuum` additionally compacts local libsql database files to return the freed space to your disk, and reports the reclaimed size. Compaction streams a `VACUUM INTO` copy and swaps it into place — bounded memory and no WAL growth even on multi-GB databases — and refuses to start without enough free disk space for the copy
  - `/prune keep-memory` skips chat history (messages and threads) so conversations are preserved for later use (fine-tuning, evals) while telemetry and run records are still deleted. Flags combine in any order, e.g. `/prune vacuum keep-memory`
  - Compaction proves it has exclusive access to each database file before swapping. If another Mastra Code session still has the file open, `/prune vacuum` refuses with a clear message instead of silently orphaning that session's writes

  Maintenance runs outside the TUI so retention deletes and `VACUUM` never contend with a live session for the database.

  Also, when local tracing is disabled, observability data is no longer written to the libsql database at all.

### Patch Changes

- Fixed TUI height corruption caused by unsanitized ANSI escape codes in tool output. pi-tui's extractAnsiCode() only handles CSI sequences ending with m/G/K/H/J; other terminators (cursor movement, mode switches) caused the scanner to swallow subsequent visible text, making visibleWidth() undercount and collapsing the TUI to a few rows. Added sanitizeAnsiForRendering() to strip non-SGR CSI sequences at all content entry points. Also improved terminal cleanup on exit to prevent Kitty keyboard protocol from leaking (5;99~ codes). ([#18735](https://github.com/mastra-ai/mastra/pull/18735))

- Improved Mastra Code responsiveness while tool inputs and command output stream. ([#19376](https://github.com/mastra-ai/mastra/pull/19376))

- Renamed the gateway setup confirmation messages to say "Gateway" instead of "Memory gateway" and added `/gateway` as an alias for the existing `/memory-gateway` setup command. ([#18691](https://github.com/mastra-ai/mastra/pull/18691))

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

- Improved Observational Memory settings by adding the `/memory` command and clarifying what each token setting counts. ([#19293](https://github.com/mastra-ai/mastra/pull/19293))

- Fixed terminal output reflow and slash command input alignment when resizing. ([#19198](https://github.com/mastra-ai/mastra/pull/19198))

- Publish the Mastra Code agent core as `@mastra/code-sdk` (previously the internal `@internal/mastracode` package), so third parties can build their own UIs and surfaces on top of the Mastra Code coding agent. The `mastracode` CLI now consumes it as a regular runtime dependency instead of bundling it into its published output. ([#18986](https://github.com/mastra-ai/mastra/pull/18986))

- Fixed the /login command changing your active model and model pack. Logging in to a provider now keeps your current model selection; the provider default is only auto-selected during onboarding or when no model has been chosen yet. ([#19250](https://github.com/mastra-ai/mastra/pull/19250))

- Improved Mastra Code web interface state handling without changing behavior. ([#19107](https://github.com/mastra-ai/mastra/pull/19107))

- Simplified the observational memory context indicator in the TUI footer. ([#19260](https://github.com/mastra-ai/mastra/pull/19260))

- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`fe1bda0`](https://github.com/mastra-ai/mastra/commit/fe1bda06f6af92a694a51712db747cda1e7185f0), [`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`1ce5121`](https://github.com/mastra-ai/mastra/commit/1ce512155d122bb21f47d98383e82ffbf84b39e8), [`fb8aea3`](https://github.com/mastra-ai/mastra/commit/fb8aea384291e77311be3a64ee1717320d5c3c73), [`4adc391`](https://github.com/mastra-ai/mastra/commit/4adc3911075249c352bb4832d2471922826344de), [`a5c6337`](https://github.com/mastra-ai/mastra/commit/a5c6337d23c7686c81a32ce62f550f610543a240), [`031931a`](https://github.com/mastra-ai/mastra/commit/031931a715405fb90759b1903c9c25cbf05994af), [`3cfc47a`](https://github.com/mastra-ai/mastra/commit/3cfc47a6b89940aadd0f46fb01ae9624a73a865d), [`eb70da9`](https://github.com/mastra-ai/mastra/commit/eb70da98e1007b18e1463d75121bc07db55f8e09), [`2bb7817`](https://github.com/mastra-ai/mastra/commit/2bb78176112fde628483de2830528f7eee911e56), [`51d9870`](https://github.com/mastra-ai/mastra/commit/51d987032c689c2855374d0f244f5d654da809d1), [`5cab274`](https://github.com/mastra-ai/mastra/commit/5cab2744250e22d12fefa7b32637dce224233cee), [`7fa27d3`](https://github.com/mastra-ai/mastra/commit/7fa27d3b6f5ed68cd34e454a4d3ad9c482a0cfbc), [`8b97958`](https://github.com/mastra-ai/mastra/commit/8b979589f9aa59ba67cac565949475f2ffeb4ac3), [`8410541`](https://github.com/mastra-ai/mastra/commit/84105412c60ecd3bb33a9838146f59c4b588228f), [`ce16147`](https://github.com/mastra-ai/mastra/commit/ce16147c0dffb34d5df4602607e4b34349fbf547), [`a58dcbb`](https://github.com/mastra-ai/mastra/commit/a58dcbb546d7e1d65ebdc1f39e55f0908fcd9391), [`aa38805`](https://github.com/mastra-ai/mastra/commit/aa38805b878b827403be785eb90688d7172f5a40), [`153bd3b`](https://github.com/mastra-ai/mastra/commit/153bd3b396bdfed6b74cf43de12db8fd2d83c04a), [`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`e955965`](https://github.com/mastra-ai/mastra/commit/e955965dce575a903e37cf054d28ea99aa48785e), [`bc1121a`](https://github.com/mastra-ai/mastra/commit/bc1121a7bb98f7cd73e82e3a7913a667a9fa9911), [`2d22570`](https://github.com/mastra-ai/mastra/commit/2d22570c7dfdd02123d0ecc529efb05ccba2d9fc), [`07bb863`](https://github.com/mastra-ai/mastra/commit/07bb8631919c6f7cf377dccd45b096e0f17fbed0), [`171c3a2`](https://github.com/mastra-ai/mastra/commit/171c3a23f36199ad1354166fb515b22b57f310c2), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`ae510ef`](https://github.com/mastra-ai/mastra/commit/ae510ef404f760d1b34eb25e99d5e6a9e9fcbdba), [`01b338c`](https://github.com/mastra-ai/mastra/commit/01b338c56271f0219606710e3e8b26dee27ac6c2), [`0cf3826`](https://github.com/mastra-ai/mastra/commit/0cf38268cee1913d1292d7d917c76744ea2aee6c), [`bd4d720`](https://github.com/mastra-ai/mastra/commit/bd4d720458e42c49b6829c4662812332be32cfcf), [`aac3e5a`](https://github.com/mastra-ai/mastra/commit/aac3e5a098b08077c7d5020d782d6353b217797c), [`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`860ef7e`](https://github.com/mastra-ai/mastra/commit/860ef7e77d92b63469cbe5857aa1e626197e43e9), [`17e818c`](https://github.com/mastra-ai/mastra/commit/17e818c51a958ba90641b1a959dc38faf8c034e9), [`edce8d2`](https://github.com/mastra-ai/mastra/commit/edce8d2769f19e27a05737c627af2d765472a4f8), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`8b7361d`](https://github.com/mastra-ai/mastra/commit/8b7361d35de68b80d05d30a74e0c69e7218fd612), [`c3a6638`](https://github.com/mastra-ai/mastra/commit/c3a6638c791ab839c52a3250ba90420c6259ae56), [`1d39058`](https://github.com/mastra-ai/mastra/commit/1d39058e548efd691799985d5c8af2737f1c3bd2), [`3927473`](https://github.com/mastra-ai/mastra/commit/392747323ddb10c643d12be7b9ae913159dfaeed), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`85fb642`](https://github.com/mastra-ai/mastra/commit/85fb642f4d112d0da9f39808617397f7e47fe622), [`6789ab4`](https://github.com/mastra-ai/mastra/commit/6789ab4191ddcd32a932898b360b191e80cee1a9), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`634caff`](https://github.com/mastra-ai/mastra/commit/634caff29a9200ad058b67d53f96d9e5832fb8a2), [`e405085`](https://github.com/mastra-ai/mastra/commit/e405085fa8ee5ea07670b8d2b62b2376c0e0e414), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`5ad8d04`](https://github.com/mastra-ai/mastra/commit/5ad8d045d2f0363690f9752180e0934beca9f33a), [`481c112`](https://github.com/mastra-ai/mastra/commit/481c1125b752489673ec671fcb7ca80f9c86ffb1), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3), [`2eb656e`](https://github.com/mastra-ai/mastra/commit/2eb656ecb64671d4a95e3c94bf507ce6a0ef9e3b), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5), [`177010f`](https://github.com/mastra-ai/mastra/commit/177010ff096d2e4b28d89803be5b1a4cad2a0d6b), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5), [`b486abf`](https://github.com/mastra-ai/mastra/commit/b486abfa2a7528c6f527e4015c819ea9fa54aaad), [`54a51e0`](https://github.com/mastra-ai/mastra/commit/54a51e0a484fe1ebad3fb1f7ef5282a075709eb7), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b), [`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6), [`1b6e676`](https://github.com/mastra-ai/mastra/commit/1b6e67613c2a019df5920d4273d79bed09555807), [`4ce0163`](https://github.com/mastra-ai/mastra/commit/4ce0163dc86e675a86809685c8ce6c49f1aeb87e), [`4378341`](https://github.com/mastra-ai/mastra/commit/43783412df5ea3dd35f5b1f6e4851e79c346fc89)]:
  - @mastra/code-sdk@0.1.0
  - @mastra/core@1.51.0
  - @mastra/memory@1.23.0
  - @mastra/mcp@1.14.0
  - @mastra/schema-compat@1.3.4
  - @mastra/observability@1.16.1
  - @mastra/pg@1.16.0
  - @mastra/libsql@1.16.0

## 0.31.0-alpha.14

### Patch Changes

- Updated dependencies [[`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5)]:
  - @mastra/core@1.51.0-alpha.13
  - @mastra/pg@1.16.0-alpha.0
  - @mastra/libsql@1.16.0-alpha.1
  - @mastra/code-sdk@0.1.0-alpha.13

## 0.31.0-alpha.13

### Patch Changes

- Updated dependencies [[`ce16147`](https://github.com/mastra-ai/mastra/commit/ce16147c0dffb34d5df4602607e4b34349fbf547), [`aa38805`](https://github.com/mastra-ai/mastra/commit/aa38805b878b827403be785eb90688d7172f5a40), [`2d22570`](https://github.com/mastra-ai/mastra/commit/2d22570c7dfdd02123d0ecc529efb05ccba2d9fc), [`4378341`](https://github.com/mastra-ai/mastra/commit/43783412df5ea3dd35f5b1f6e4851e79c346fc89)]:
  - @mastra/code-sdk@0.1.0-alpha.12
  - @mastra/core@1.51.0-alpha.12

## 0.31.0-alpha.12

### Patch Changes

- Updated dependencies [[`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59)]:
  - @mastra/core@1.51.0-alpha.11
  - @mastra/code-sdk@0.1.0-alpha.11

## 0.31.0-alpha.11

### Patch Changes

- Updated dependencies [[`4adc391`](https://github.com/mastra-ai/mastra/commit/4adc3911075249c352bb4832d2471922826344de), [`171c3a2`](https://github.com/mastra-ai/mastra/commit/171c3a23f36199ad1354166fb515b22b57f310c2), [`b486abf`](https://github.com/mastra-ai/mastra/commit/b486abfa2a7528c6f527e4015c819ea9fa54aaad)]:
  - @mastra/core@1.51.0-alpha.10
  - @mastra/schema-compat@1.3.4-alpha.2
  - @mastra/code-sdk@0.1.0-alpha.10
  - @mastra/mcp@1.14.0-alpha.0
  - @mastra/memory@1.23.0-alpha.4

## 0.31.0-alpha.10

### Patch Changes

- Updated dependencies [[`edce8d2`](https://github.com/mastra-ai/mastra/commit/edce8d2769f19e27a05737c627af2d765472a4f8)]:
  - @mastra/core@1.51.0-alpha.9
  - @mastra/code-sdk@0.1.0-alpha.9

## 0.31.0-alpha.9

### Patch Changes

- Improved Mastra Code responsiveness while tool inputs and command output stream. ([#19376](https://github.com/mastra-ai/mastra/pull/19376))

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
- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`c3a6638`](https://github.com/mastra-ai/mastra/commit/c3a6638c791ab839c52a3250ba90420c6259ae56), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b)]:
  - @mastra/code-sdk@0.1.0-alpha.8
  - @mastra/core@1.51.0-alpha.8

## 0.31.0-alpha.8

### Patch Changes

- Renamed the gateway setup confirmation messages to say "Gateway" instead of "Memory gateway" and added `/gateway` as an alias for the existing `/memory-gateway` setup command. ([#18691](https://github.com/mastra-ai/mastra/pull/18691))

- Improved Observational Memory settings by adding the `/memory` command and clarifying what each token setting counts. ([#19293](https://github.com/mastra-ai/mastra/pull/19293))

- Simplified the observational memory context indicator in the TUI footer. ([#19260](https://github.com/mastra-ai/mastra/pull/19260))

- Updated dependencies [[`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`1ce5121`](https://github.com/mastra-ai/mastra/commit/1ce512155d122bb21f47d98383e82ffbf84b39e8), [`3cfc47a`](https://github.com/mastra-ai/mastra/commit/3cfc47a6b89940aadd0f46fb01ae9624a73a865d), [`2bb7817`](https://github.com/mastra-ai/mastra/commit/2bb78176112fde628483de2830528f7eee911e56), [`51d9870`](https://github.com/mastra-ai/mastra/commit/51d987032c689c2855374d0f244f5d654da809d1), [`5cab274`](https://github.com/mastra-ai/mastra/commit/5cab2744250e22d12fefa7b32637dce224233cee), [`7fa27d3`](https://github.com/mastra-ai/mastra/commit/7fa27d3b6f5ed68cd34e454a4d3ad9c482a0cfbc), [`a58dcbb`](https://github.com/mastra-ai/mastra/commit/a58dcbb546d7e1d65ebdc1f39e55f0908fcd9391), [`153bd3b`](https://github.com/mastra-ai/mastra/commit/153bd3b396bdfed6b74cf43de12db8fd2d83c04a), [`07bb863`](https://github.com/mastra-ai/mastra/commit/07bb8631919c6f7cf377dccd45b096e0f17fbed0), [`ae510ef`](https://github.com/mastra-ai/mastra/commit/ae510ef404f760d1b34eb25e99d5e6a9e9fcbdba), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`3927473`](https://github.com/mastra-ai/mastra/commit/392747323ddb10c643d12be7b9ae913159dfaeed), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`634caff`](https://github.com/mastra-ai/mastra/commit/634caff29a9200ad058b67d53f96d9e5832fb8a2), [`5ad8d04`](https://github.com/mastra-ai/mastra/commit/5ad8d045d2f0363690f9752180e0934beca9f33a), [`2eb656e`](https://github.com/mastra-ai/mastra/commit/2eb656ecb64671d4a95e3c94bf507ce6a0ef9e3b), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669)]:
  - @mastra/core@1.51.0-alpha.7
  - @mastra/code-sdk@0.1.0-alpha.7
  - @mastra/observability@1.16.1-alpha.1
  - @mastra/mcp@1.14.0-alpha.0

## 0.31.0-alpha.7

### Patch Changes

- Updated dependencies [[`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6)]:
  - @mastra/core@1.51.0-alpha.6
  - @mastra/code-sdk@0.1.0-alpha.6

## 0.31.0-alpha.6

### Patch Changes

- Updated dependencies [[`fb8aea3`](https://github.com/mastra-ai/mastra/commit/fb8aea384291e77311be3a64ee1717320d5c3c73), [`bd4d720`](https://github.com/mastra-ai/mastra/commit/bd4d720458e42c49b6829c4662812332be32cfcf), [`4ce0163`](https://github.com/mastra-ai/mastra/commit/4ce0163dc86e675a86809685c8ce6c49f1aeb87e)]:
  - @mastra/core@1.51.0-alpha.5
  - @mastra/observability@1.16.1-alpha.0
  - @mastra/code-sdk@0.1.0-alpha.5
  - @mastra/mcp@1.14.0-alpha.0

## 0.31.0-alpha.5

### Patch Changes

- Fixed terminal output reflow and slash command input alignment when resizing. ([#19198](https://github.com/mastra-ai/mastra/pull/19198))

- Fixed the /login command changing your active model and model pack. Logging in to a provider now keeps your current model selection; the provider default is only auto-selected during onboarding or when no model has been chosen yet. ([#19250](https://github.com/mastra-ai/mastra/pull/19250))

- Updated dependencies [[`a5c6337`](https://github.com/mastra-ai/mastra/commit/a5c6337d23c7686c81a32ce62f550f610543a240), [`031931a`](https://github.com/mastra-ai/mastra/commit/031931a715405fb90759b1903c9c25cbf05994af), [`eb70da9`](https://github.com/mastra-ai/mastra/commit/eb70da98e1007b18e1463d75121bc07db55f8e09), [`8b97958`](https://github.com/mastra-ai/mastra/commit/8b979589f9aa59ba67cac565949475f2ffeb4ac3), [`8410541`](https://github.com/mastra-ai/mastra/commit/84105412c60ecd3bb33a9838146f59c4b588228f), [`01b338c`](https://github.com/mastra-ai/mastra/commit/01b338c56271f0219606710e3e8b26dee27ac6c2), [`8b7361d`](https://github.com/mastra-ai/mastra/commit/8b7361d35de68b80d05d30a74e0c69e7218fd612), [`85fb642`](https://github.com/mastra-ai/mastra/commit/85fb642f4d112d0da9f39808617397f7e47fe622), [`481c112`](https://github.com/mastra-ai/mastra/commit/481c1125b752489673ec671fcb7ca80f9c86ffb1), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3)]:
  - @mastra/core@1.51.0-alpha.4
  - @mastra/memory@1.23.0-alpha.3
  - @mastra/mcp@1.14.0-alpha.0
  - @mastra/code-sdk@0.1.0-alpha.4

## 0.31.0-alpha.4

### Patch Changes

- Updated dependencies [[`177010f`](https://github.com/mastra-ai/mastra/commit/177010ff096d2e4b28d89803be5b1a4cad2a0d6b), [`54a51e0`](https://github.com/mastra-ai/mastra/commit/54a51e0a484fe1ebad3fb1f7ef5282a075709eb7)]:
  - @mastra/core@1.51.0-alpha.3
  - @mastra/code-sdk@0.1.0-alpha.3

## 0.31.0-alpha.3

### Minor Changes

- Added storage retention and a new `/prune` command to keep the local database from growing without bound. ([#19059](https://github.com/mastra-ai/mastra/pull/19059))

  **Default retention policies** are now applied to Mastra Code storage: chat messages and threads are kept for 90 days, observability spans and logs for 14 days, scores and workflow snapshots for 30 days. Rows older than these limits are only removed when you run `/prune` — nothing is deleted automatically.

  **New `/prune` command:**
  - `/prune` closes the TUI, hands the terminal over to a maintenance run that deletes rows older than the retention policies with live progress output, then exits (start `mastracode` again for a new session)
  - `/prune vacuum` additionally compacts local libsql database files to return the freed space to your disk, and reports the reclaimed size. Compaction streams a `VACUUM INTO` copy and swaps it into place — bounded memory and no WAL growth even on multi-GB databases — and refuses to start without enough free disk space for the copy
  - `/prune keep-memory` skips chat history (messages and threads) so conversations are preserved for later use (fine-tuning, evals) while telemetry and run records are still deleted. Flags combine in any order, e.g. `/prune vacuum keep-memory`
  - Compaction proves it has exclusive access to each database file before swapping. If another Mastra Code session still has the file open, `/prune vacuum` refuses with a clear message instead of silently orphaning that session's writes

  Maintenance runs outside the TUI so retention deletes and `VACUUM` never contend with a live session for the database.

  Also, when local tracing is disabled, observability data is no longer written to the libsql database at all.

### Patch Changes

- Updated dependencies [[`e955965`](https://github.com/mastra-ai/mastra/commit/e955965dce575a903e37cf054d28ea99aa48785e), [`bc1121a`](https://github.com/mastra-ai/mastra/commit/bc1121a7bb98f7cd73e82e3a7913a667a9fa9911), [`860ef7e`](https://github.com/mastra-ai/mastra/commit/860ef7e77d92b63469cbe5857aa1e626197e43e9), [`17e818c`](https://github.com/mastra-ai/mastra/commit/17e818c51a958ba90641b1a959dc38faf8c034e9), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`1d39058`](https://github.com/mastra-ai/mastra/commit/1d39058e548efd691799985d5c8af2737f1c3bd2)]:
  - @mastra/core@1.51.0-alpha.2
  - @mastra/schema-compat@1.3.4-alpha.1
  - @mastra/libsql@1.16.0-alpha.0
  - @mastra/code-sdk@0.1.0-alpha.2
  - @mastra/mcp@1.13.1
  - @mastra/memory@1.23.0-alpha.2

## 0.30.1-alpha.2

### Patch Changes

- Updated dependencies [[`aac3e5a`](https://github.com/mastra-ai/mastra/commit/aac3e5a098b08077c7d5020d782d6353b217797c), [`1b6e676`](https://github.com/mastra-ai/mastra/commit/1b6e67613c2a019df5920d4273d79bed09555807)]:
  - @mastra/memory@1.23.0-alpha.1
  - @mastra/code-sdk@0.1.0-alpha.1

## 0.30.1-alpha.1

### Patch Changes

- Fixed TUI height corruption caused by unsanitized ANSI escape codes in tool output. pi-tui's extractAnsiCode() only handles CSI sequences ending with m/G/K/H/J; other terminators (cursor movement, mode switches) caused the scanner to swallow subsequent visible text, making visibleWidth() undercount and collapsing the TUI to a few rows. Added sanitizeAnsiForRendering() to strip non-SGR CSI sequences at all content entry points. Also improved terminal cleanup on exit to prevent Kitty keyboard protocol from leaking (5;99~ codes). ([#18735](https://github.com/mastra-ai/mastra/pull/18735))

- Publish the Mastra Code agent core as `@mastra/code-sdk` (previously the internal `@internal/mastracode` package), so third parties can build their own UIs and surfaces on top of the Mastra Code coding agent. The `mastracode` CLI now consumes it as a regular runtime dependency instead of bundling it into its published output. ([#18986](https://github.com/mastra-ai/mastra/pull/18986))

- Improved Mastra Code web interface state handling without changing behavior. ([#19107](https://github.com/mastra-ai/mastra/pull/19107))

- Updated dependencies [[`0cf3826`](https://github.com/mastra-ai/mastra/commit/0cf38268cee1913d1292d7d917c76744ea2aee6c), [`6789ab4`](https://github.com/mastra-ai/mastra/commit/6789ab4191ddcd32a932898b360b191e80cee1a9), [`e405085`](https://github.com/mastra-ai/mastra/commit/e405085fa8ee5ea07670b8d2b62b2376c0e0e414)]:
  - @mastra/code-sdk@0.1.0-alpha.0
  - @mastra/schema-compat@1.3.4-alpha.0
  - @mastra/core@1.50.2-alpha.1
  - @mastra/mcp@1.13.1
  - @mastra/memory@1.22.3-alpha.0

## 0.30.1-alpha.0

### Patch Changes

- Updated dependencies [[`fe1bda0`](https://github.com/mastra-ai/mastra/commit/fe1bda06f6af92a694a51712db747cda1e7185f0)]:
  - @mastra/core@1.50.2-alpha.0
  - @mastra/client-js@1.31.2-alpha.0
  - @mastra/react@1.2.5-alpha.0
  - @mastra/playground-ui@40.0.2-alpha.0
  - @mastra/server@1.50.2-alpha.0
  - @mastra/hono@1.5.7-alpha.0

## 0.30.0

### Minor Changes

- Added URL-driven thread pages to the MastraCode web UI. Each conversation now lives at its own /threads/:threadId URL, so threads can be deep-linked, refreshed, and navigated with the browser's back/forward buttons. ([#19062](https://github.com/mastra-ai/mastra/pull/19062))

  **What changed for users**
  - Clicking a thread in the sidebar navigates to its page instead of swapping content in place
  - /chat is now a draft page: composing there creates the thread on first send and then navigates to /threads/:id
  - The new-thread button opens the /chat draft page instead of immediately creating an empty thread
  - Cloning a thread lands on the new thread's URL; deleting the active thread returns to /chat
  - Thread history now loads through a cached query with a skeleton loading state instead of a blank flash
  - Fixed a race where switching threads from the sidebar could show an empty transcript instead of the thread's history

### Patch Changes

- Improved MastraCode web chat routing and composer layout. ([#19062](https://github.com/mastra-ai/mastra/pull/19062))

- Fixed GitHub plugins so their dependencies are installed when plugins are installed or updated. ([#19013](https://github.com/mastra-ai/mastra/pull/19013))

- Fixed GitHub plugin setup when running Mastra Code from a source-built bundle and installing plugins that require a different pnpm version. ([#19067](https://github.com/mastra-ai/mastra/pull/19067))

- Updated dependencies [[`e900f25`](https://github.com/mastra-ai/mastra/commit/e900f25dfe2c9237f15b26cb109ac55aa9de3000), [`358a0b2`](https://github.com/mastra-ai/mastra/commit/358a0b2230898edf85855727fbbaf61067e33816), [`e8eaf3a`](https://github.com/mastra-ai/mastra/commit/e8eaf3aea09d51c131b5d369aee459442f416efc), [`d1c930f`](https://github.com/mastra-ai/mastra/commit/d1c930f713d1de09d5f3cd665cb79a8b7ebd7ec7), [`189200a`](https://github.com/mastra-ai/mastra/commit/189200a325314505f45590dabd6c4c02790baa29), [`02634f7`](https://github.com/mastra-ai/mastra/commit/02634f700051e014a125d0d10165e3c9b8414e95), [`27492f2`](https://github.com/mastra-ai/mastra/commit/27492f24ee4960afefb1268a4d38201cd0779566), [`a940148`](https://github.com/mastra-ai/mastra/commit/a9401483e1bfe85c18a6e73d33c5949239d65a92), [`a223279`](https://github.com/mastra-ai/mastra/commit/a223279c8658cc6cc40c554d6d3569c04823806c)]:
  - @mastra/core@1.50.1
  - @mastra/duckdb@1.5.1
  - @mastra/playground-ui@40.0.1
  - @mastra/memory@1.22.2
  - @mastra/client-js@1.31.1
  - @mastra/hono@1.5.6
  - @mastra/react@1.2.4
  - @mastra/server@1.50.1

## 0.30.0-alpha.3

### Patch Changes

- Fixed GitHub plugin setup when running Mastra Code from a source-built bundle and installing plugins that require a different pnpm version. ([#19067](https://github.com/mastra-ai/mastra/pull/19067))

- Updated dependencies [[`27492f2`](https://github.com/mastra-ai/mastra/commit/27492f24ee4960afefb1268a4d38201cd0779566)]:
  - @mastra/memory@1.22.2-alpha.0
  - @mastra/hono@1.5.6-alpha.2
  - @mastra/server@1.50.1-alpha.2

## 0.30.0-alpha.2

### Minor Changes

- Added URL-driven thread pages to the MastraCode web UI. Each conversation now lives at its own /threads/:threadId URL, so threads can be deep-linked, refreshed, and navigated with the browser's back/forward buttons. ([#19062](https://github.com/mastra-ai/mastra/pull/19062))

  **What changed for users**
  - Clicking a thread in the sidebar navigates to its page instead of swapping content in place
  - /chat is now a draft page: composing there creates the thread on first send and then navigates to /threads/:id
  - The new-thread button opens the /chat draft page instead of immediately creating an empty thread
  - Cloning a thread lands on the new thread's URL; deleting the active thread returns to /chat
  - Thread history now loads through a cached query with a skeleton loading state instead of a blank flash
  - Fixed a race where switching threads from the sidebar could show an empty transcript instead of the thread's history

### Patch Changes

- Improved MastraCode web chat routing and composer layout. ([#19062](https://github.com/mastra-ai/mastra/pull/19062))

- Updated dependencies [[`358a0b2`](https://github.com/mastra-ai/mastra/commit/358a0b2230898edf85855727fbbaf61067e33816), [`189200a`](https://github.com/mastra-ai/mastra/commit/189200a325314505f45590dabd6c4c02790baa29), [`a940148`](https://github.com/mastra-ai/mastra/commit/a9401483e1bfe85c18a6e73d33c5949239d65a92)]:
  - @mastra/duckdb@1.5.1-alpha.0
  - @mastra/playground-ui@40.0.1-alpha.2
  - @mastra/core@1.50.1-alpha.2
  - @mastra/client-js@1.31.1-alpha.2
  - @mastra/react@1.2.4-alpha.2
  - @mastra/server@1.50.1-alpha.2
  - @mastra/hono@1.5.6-alpha.2

## 0.29.1-alpha.1

### Patch Changes

- Updated dependencies [[`e8eaf3a`](https://github.com/mastra-ai/mastra/commit/e8eaf3aea09d51c131b5d369aee459442f416efc), [`d1c930f`](https://github.com/mastra-ai/mastra/commit/d1c930f713d1de09d5f3cd665cb79a8b7ebd7ec7), [`02634f7`](https://github.com/mastra-ai/mastra/commit/02634f700051e014a125d0d10165e3c9b8414e95), [`a223279`](https://github.com/mastra-ai/mastra/commit/a223279c8658cc6cc40c554d6d3569c04823806c)]:
  - @mastra/core@1.50.1-alpha.1
  - @mastra/playground-ui@40.0.1-alpha.1
  - @mastra/client-js@1.31.1-alpha.1
  - @mastra/react@1.2.4-alpha.1
  - @mastra/server@1.50.1-alpha.1
  - @mastra/hono@1.5.6-alpha.1

## 0.29.1-alpha.0

### Patch Changes

- Fixed GitHub plugins so their dependencies are installed when plugins are installed or updated. ([#19013](https://github.com/mastra-ai/mastra/pull/19013))

- Updated dependencies [[`e900f25`](https://github.com/mastra-ai/mastra/commit/e900f25dfe2c9237f15b26cb109ac55aa9de3000)]:
  - @mastra/core@1.50.1-alpha.0
  - @mastra/client-js@1.31.1-alpha.0
  - @mastra/react@1.2.4-alpha.0
  - @mastra/playground-ui@40.0.1-alpha.0
  - @mastra/server@1.50.1-alpha.0
  - @mastra/hono@1.5.6-alpha.0

## 0.29.0

### Minor Changes

- Run the MastraCode web server through the Mastra CLI so `mastra dev`, `mastra build`, `mastra deploy`, and `mastra start` all serve the same API surface from `src/mastra/index.ts`. The separate hand-wired local server was removed, and the web UI is now hosted separately and talks to the API cross-origin. ([#18741](https://github.com/mastra-ai/mastra/pull/18741))

### Patch Changes

- Improved MastraCode web syntax highlighting, switched the web UI to the shared Playground UI stylesheet, restored React Query-backed sidebar auth actions, reorganized the web UI internals into reusable UI and domain folders, added a React Query-backed Workspaces sidebar section for GitHub project worktrees, moved project/repository data loading onto React Query-backed domain hooks, and consolidated global keydown listeners behind a shared `useKeyDown` hook. ([#18851](https://github.com/mastra-ai/mastra/pull/18851))

- Added dedicated routes to the mastracode web UI: the chat now lives at /chat and signing in happens on a new /signin page. When web auth is enabled, signed-out visitors are redirected to /signin (instead of straight to the hosted login) and returned to where they were headed after signing in. The sidebar no longer shows a Sign in button; it only shows the signed-in identity and sign-out. ([#18912](https://github.com/mastra-ai/mastra/pull/18912))

  The UI now reads a `window.__MASTRACODE_CONFIG__` runtime flag (injected by the Vite dev server from the WorkOS env vars) telling it whether auth is enabled, so it skips the `/auth/me` probe entirely when auth is disabled. All web UI fetches (auth, GitHub, project resolution) go through the injected API base URL so requests reach the backend when the dev frontend and server run on different ports, and deep-linking to /chat no longer serves raw module source from the dev server.

- Web UI overhaul: internal refactor plus skeleton loading states. ([#18983](https://github.com/mastra-ai/mastra/pull/18983))
  - Loading states now render skeleton placeholders instead of loading text or blank screens (settings sections, directory picker, GitHub repo list, sidebar sign-in check, and route auth guards).
  - Internal refactor with no user-facing behavior changes: prop drilling replaced with dedicated React contexts (project selection, chat session, overlays), the AppLayout/AppContent indirection dissolved into a slotted ChatLayout with chat-domain components (ChatHeader, ChatMessageList, ComposerPanel, ChatOverlays), sidebar sections consume contexts directly, and the relativeTime helper moved to a shared date module backed by date-fns.

- Updated dependencies [[`81e1ad4`](https://github.com/mastra-ai/mastra/commit/81e1ad440fd7ae0cd3b2977ae0c31eab0168efa7), [`b291760`](https://github.com/mastra-ai/mastra/commit/b291760df9d6c7e4fc72606c8f0a4af2cf6e946c), [`3ffb8b7`](https://github.com/mastra-ai/mastra/commit/3ffb8b720e90f5e6977129ec1f6707d43c2bebe0), [`6ef59fe`](https://github.com/mastra-ai/mastra/commit/6ef59fef1da52ed8da5fbb2a892c71cf4fb6c739), [`c606314`](https://github.com/mastra-ai/mastra/commit/c606314119db8ed69eaf20da2ba213a2fb6d6c21), [`4039488`](https://github.com/mastra-ai/mastra/commit/403948898af7293198d9e8b3e7fb47f623c78b94), [`29b7ea6`](https://github.com/mastra-ai/mastra/commit/29b7ea64e72b5523d5bdcbd34ee03d2b854d54e1), [`1d606ff`](https://github.com/mastra-ai/mastra/commit/1d606ff3570179d9ed43c90e8c2bf8d011e97bea), [`b2c9d70`](https://github.com/mastra-ai/mastra/commit/b2c9d70757207fb01a9069549e69b6f0d73a6636), [`a51c63d`](https://github.com/mastra-ai/mastra/commit/a51c63d8ee639e4daeba2a0be093efa6a1b5e52f), [`252f63d`](https://github.com/mastra-ai/mastra/commit/252f63d8fec723955adb2202be2f01a75ad0e69c), [`5ea76a7`](https://github.com/mastra-ai/mastra/commit/5ea76a723d966c72da9aa3ab30ae20276e049765), [`6445560`](https://github.com/mastra-ai/mastra/commit/6445560327045d20b239585fc63fed72e9ce36ec), [`82f0f43`](https://github.com/mastra-ai/mastra/commit/82f0f439600871ca2d20ab6fced2c68db1e42536), [`e2b9f33`](https://github.com/mastra-ai/mastra/commit/e2b9f33456fd638eca555f9466c6519d8d049666), [`10959d5`](https://github.com/mastra-ai/mastra/commit/10959d509d824f682d40ff96e05ee044aec3b0e5), [`26b593d`](https://github.com/mastra-ai/mastra/commit/26b593de99d5745e069994fab14f1e12f2db8c4c), [`c547a77`](https://github.com/mastra-ai/mastra/commit/c547a7729bdf64dfc2df29c965046c0712a18f10), [`b9b8599`](https://github.com/mastra-ai/mastra/commit/b9b85993050b3cc50b2651d2a372e4f6b96a5927), [`f6e7bb3`](https://github.com/mastra-ai/mastra/commit/f6e7bb3ccffc4cab6ce6ea5c031c8cb528e5f101), [`a0085fa`](https://github.com/mastra-ai/mastra/commit/a0085fa0934e52c37c8c8b3d75a6bb5cd199af36), [`4606ade`](https://github.com/mastra-ai/mastra/commit/4606adee3c79f83a743b2c523c6f8b34be9b3250), [`911281c`](https://github.com/mastra-ai/mastra/commit/911281c57893ba2630428bf88d0cd0c5101ce76f), [`a2ba369`](https://github.com/mastra-ai/mastra/commit/a2ba369e796dfab610f41c6875965b488272fa55), [`d889c04`](https://github.com/mastra-ai/mastra/commit/d889c046468a97ba9e90007dbca729b4fecf5db0), [`ffc3c17`](https://github.com/mastra-ai/mastra/commit/ffc3c17274ea17c11aa6f73d3140649cd7fc8abc), [`81542c1`](https://github.com/mastra-ai/mastra/commit/81542c1835c35bc32f2ce4fa9136ee11993cd299), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee), [`cb24ce7`](https://github.com/mastra-ai/mastra/commit/cb24ce76bd16ca88eb6a963f6277f8780e703029), [`02705fd`](https://github.com/mastra-ai/mastra/commit/02705fd2f5a9062210d64ea061adeeb10dc9452e), [`ae51e81`](https://github.com/mastra-ai/mastra/commit/ae51e818825582d42500338dfc1929a082eff0ba), [`6f304ef`](https://github.com/mastra-ai/mastra/commit/6f304ef319e99725e884bdb8d3193c001b6e5964), [`5f9858f`](https://github.com/mastra-ai/mastra/commit/5f9858f791f1137ca7d52d23559fb4568f7a9026)]:
  - @mastra/agent-browser@0.4.1
  - @mastra/core@1.50.0
  - @mastra/playground-ui@40.0.0
  - @mastra/observability@1.16.0
  - @mastra/react@1.2.3
  - @mastra/client-js@1.31.0
  - @mastra/server@1.50.0
  - @mastra/pg@1.15.1
  - @mastra/mcp@1.13.1
  - @mastra/libsql@1.15.1
  - @mastra/hono@1.5.5

## 0.29.0-alpha.5

### Patch Changes

- Updated dependencies [[`a0085fa`](https://github.com/mastra-ai/mastra/commit/a0085fa0934e52c37c8c8b3d75a6bb5cd199af36)]:
  - @mastra/core@1.50.0-alpha.5
  - @mastra/client-js@1.31.0-alpha.5
  - @mastra/react@1.2.3-alpha.5
  - @mastra/playground-ui@40.0.0-alpha.5
  - @mastra/server@1.50.0-alpha.5
  - @mastra/hono@1.5.5-alpha.5

## 0.29.0-alpha.4

### Patch Changes

- Updated dependencies [[`4039488`](https://github.com/mastra-ai/mastra/commit/403948898af7293198d9e8b3e7fb47f623c78b94), [`b2c9d70`](https://github.com/mastra-ai/mastra/commit/b2c9d70757207fb01a9069549e69b6f0d73a6636), [`252f63d`](https://github.com/mastra-ai/mastra/commit/252f63d8fec723955adb2202be2f01a75ad0e69c), [`26b593d`](https://github.com/mastra-ai/mastra/commit/26b593de99d5745e069994fab14f1e12f2db8c4c), [`c547a77`](https://github.com/mastra-ai/mastra/commit/c547a7729bdf64dfc2df29c965046c0712a18f10), [`b9b8599`](https://github.com/mastra-ai/mastra/commit/b9b85993050b3cc50b2651d2a372e4f6b96a5927), [`f6e7bb3`](https://github.com/mastra-ai/mastra/commit/f6e7bb3ccffc4cab6ce6ea5c031c8cb528e5f101), [`81542c1`](https://github.com/mastra-ai/mastra/commit/81542c1835c35bc32f2ce4fa9136ee11993cd299), [`cb24ce7`](https://github.com/mastra-ai/mastra/commit/cb24ce76bd16ca88eb6a963f6277f8780e703029), [`5f9858f`](https://github.com/mastra-ai/mastra/commit/5f9858f791f1137ca7d52d23559fb4568f7a9026)]:
  - @mastra/core@1.50.0-alpha.4
  - @mastra/playground-ui@40.0.0-alpha.4
  - @mastra/pg@1.15.1-alpha.1
  - @mastra/client-js@1.31.0-alpha.4
  - @mastra/react@1.2.3-alpha.4
  - @mastra/server@1.50.0-alpha.4
  - @mastra/hono@1.5.5-alpha.4

## 0.29.0-alpha.3

### Patch Changes

- Web UI overhaul: internal refactor plus skeleton loading states. ([#18983](https://github.com/mastra-ai/mastra/pull/18983))
  - Loading states now render skeleton placeholders instead of loading text or blank screens (settings sections, directory picker, GitHub repo list, sidebar sign-in check, and route auth guards).
  - Internal refactor with no user-facing behavior changes: prop drilling replaced with dedicated React contexts (project selection, chat session, overlays), the AppLayout/AppContent indirection dissolved into a slotted ChatLayout with chat-domain components (ChatHeader, ChatMessageList, ComposerPanel, ChatOverlays), sidebar sections consume contexts directly, and the relativeTime helper moved to a shared date module backed by date-fns.

- Updated dependencies [[`b291760`](https://github.com/mastra-ai/mastra/commit/b291760df9d6c7e4fc72606c8f0a4af2cf6e946c), [`c606314`](https://github.com/mastra-ai/mastra/commit/c606314119db8ed69eaf20da2ba213a2fb6d6c21), [`29b7ea6`](https://github.com/mastra-ai/mastra/commit/29b7ea64e72b5523d5bdcbd34ee03d2b854d54e1), [`82f0f43`](https://github.com/mastra-ai/mastra/commit/82f0f439600871ca2d20ab6fced2c68db1e42536), [`10959d5`](https://github.com/mastra-ai/mastra/commit/10959d509d824f682d40ff96e05ee044aec3b0e5), [`4606ade`](https://github.com/mastra-ai/mastra/commit/4606adee3c79f83a743b2c523c6f8b34be9b3250), [`d889c04`](https://github.com/mastra-ai/mastra/commit/d889c046468a97ba9e90007dbca729b4fecf5db0), [`ffc3c17`](https://github.com/mastra-ai/mastra/commit/ffc3c17274ea17c11aa6f73d3140649cd7fc8abc), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee)]:
  - @mastra/core@1.50.0-alpha.3
  - @mastra/playground-ui@40.0.0-alpha.3
  - @mastra/react@1.2.3-alpha.3
  - @mastra/server@1.50.0-alpha.3
  - @mastra/client-js@1.31.0-alpha.3
  - @mastra/libsql@1.15.1-alpha.0
  - @mastra/pg@1.15.1-alpha.0
  - @mastra/hono@1.5.5-alpha.3

## 0.29.0-alpha.2

### Patch Changes

- Updated dependencies [[`a51c63d`](https://github.com/mastra-ai/mastra/commit/a51c63d8ee639e4daeba2a0be093efa6a1b5e52f), [`02705fd`](https://github.com/mastra-ai/mastra/commit/02705fd2f5a9062210d64ea061adeeb10dc9452e)]:
  - @mastra/core@1.50.0-alpha.2
  - @mastra/client-js@1.30.1-alpha.2
  - @mastra/react@1.2.3-alpha.2
  - @mastra/playground-ui@39.0.1-alpha.2
  - @mastra/server@1.50.0-alpha.2
  - @mastra/hono@1.5.5-alpha.2

## 0.29.0-alpha.1

### Minor Changes

- Run the MastraCode web server through the Mastra CLI so `mastra dev`, `mastra build`, `mastra deploy`, and `mastra start` all serve the same API surface from `src/mastra/index.ts`. The separate hand-wired local server was removed, and the web UI is now hosted separately and talks to the API cross-origin. ([#18741](https://github.com/mastra-ai/mastra/pull/18741))

### Patch Changes

- Improved MastraCode web syntax highlighting, switched the web UI to the shared Playground UI stylesheet, restored React Query-backed sidebar auth actions, reorganized the web UI internals into reusable UI and domain folders, added a React Query-backed Workspaces sidebar section for GitHub project worktrees, moved project/repository data loading onto React Query-backed domain hooks, and consolidated global keydown listeners behind a shared `useKeyDown` hook. ([#18851](https://github.com/mastra-ai/mastra/pull/18851))

- Added dedicated routes to the mastracode web UI: the chat now lives at /chat and signing in happens on a new /signin page. When web auth is enabled, signed-out visitors are redirected to /signin (instead of straight to the hosted login) and returned to where they were headed after signing in. The sidebar no longer shows a Sign in button; it only shows the signed-in identity and sign-out. ([#18912](https://github.com/mastra-ai/mastra/pull/18912))

  The UI now reads a `window.__MASTRACODE_CONFIG__` runtime flag (injected by the Vite dev server from the WorkOS env vars) telling it whether auth is enabled, so it skips the `/auth/me` probe entirely when auth is disabled. All web UI fetches (auth, GitHub, project resolution) go through the injected API base URL so requests reach the backend when the dev frontend and server run on different ports, and deep-linking to /chat no longer serves raw module source from the dev server.

- Updated dependencies [[`81e1ad4`](https://github.com/mastra-ai/mastra/commit/81e1ad440fd7ae0cd3b2977ae0c31eab0168efa7), [`3ffb8b7`](https://github.com/mastra-ai/mastra/commit/3ffb8b720e90f5e6977129ec1f6707d43c2bebe0), [`1d606ff`](https://github.com/mastra-ai/mastra/commit/1d606ff3570179d9ed43c90e8c2bf8d011e97bea), [`5ea76a7`](https://github.com/mastra-ai/mastra/commit/5ea76a723d966c72da9aa3ab30ae20276e049765), [`6445560`](https://github.com/mastra-ai/mastra/commit/6445560327045d20b239585fc63fed72e9ce36ec), [`911281c`](https://github.com/mastra-ai/mastra/commit/911281c57893ba2630428bf88d0cd0c5101ce76f), [`a2ba369`](https://github.com/mastra-ai/mastra/commit/a2ba369e796dfab610f41c6875965b488272fa55), [`ae51e81`](https://github.com/mastra-ai/mastra/commit/ae51e818825582d42500338dfc1929a082eff0ba), [`6f304ef`](https://github.com/mastra-ai/mastra/commit/6f304ef319e99725e884bdb8d3193c001b6e5964)]:
  - @mastra/agent-browser@0.4.1-alpha.0
  - @mastra/core@1.50.0-alpha.1
  - @mastra/playground-ui@39.0.1-alpha.1
  - @mastra/observability@1.16.0-alpha.0
  - @mastra/mcp@1.13.1-alpha.0
  - @mastra/client-js@1.30.1-alpha.1
  - @mastra/hono@1.5.5-alpha.1
  - @mastra/react@1.2.3-alpha.1
  - @mastra/server@1.50.0-alpha.1

## 0.28.1-alpha.0

### Patch Changes

- Updated dependencies [[`6ef59fe`](https://github.com/mastra-ai/mastra/commit/6ef59fef1da52ed8da5fbb2a892c71cf4fb6c739), [`e2b9f33`](https://github.com/mastra-ai/mastra/commit/e2b9f33456fd638eca555f9466c6519d8d049666)]:
  - @mastra/core@1.50.0-alpha.0
  - @mastra/client-js@1.30.1-alpha.0
  - @mastra/server@1.50.0-alpha.0
  - @mastra/react@1.2.3-alpha.0
  - @mastra/playground-ui@39.0.1-alpha.0
  - @mastra/hono@1.5.5-alpha.0

## 0.28.0

### Minor Changes

- Added lifecycle hook events and a per-run `run_id` field so external orchestrators can track agent lifecycle states directly instead of inferring them from coarse prompt, tool, and stop signals. ([#18607](https://github.com/mastra-ai/mastra/pull/18607))

  **New events:** AgentStart, AgentEnd, PermissionRequest, PermissionResult, Interrupt, SubagentStart, and SubagentEnd. All new lifecycle events are non-blocking. Existing blocking events, including PreToolUse, Stop, and UserPromptSubmit, keep their current behavior.

  Every hook stdin now includes a `run_id` during an active run. Permission decisions and interrupts only emit while a run is active, so consumers can reliably correlate them with the run that produced them.

  PostToolUse continues to fire from the agent tool hook wrapper after a tool call completes. It is not emitted from the TUI lifecycle dispatcher.

  **Why**

  External orchestrators needed first-class signals for permission gates, interrupts, and subagent delegation. The previous hook surface only offered coarse prompt, tool, and stop events, forcing integrators to guess at lifecycle state.

  ```json
  {
    "AgentStart": [{ "type": "command", "command": "echo started >> /tmp/lifecycle.log" }],
    "AgentEnd": [{ "type": "command", "command": "echo ended >> /tmp/lifecycle.log" }],
    "Interrupt": [{ "type": "command", "command": "echo interrupted >> /tmp/lifecycle.log" }]
  }
  ```

  AgentStart stdin includes the shared `run_id`:

  ```json
  { "hook_event_name": "AgentStart", "run_id": "a1b2c3d4", "session_id": "...", "cwd": "/path/to/project" }
  ```

### Patch Changes

- Removed named exports from the `@mastra/playground-ui` root entry. Import public APIs from exact package subpaths instead. ([#18791](https://github.com/mastra-ai/mastra/pull/18791))

  **Before**

  ```ts
  import { Button } from '@mastra/playground-ui';
  ```

  **After**

  ```ts
  import { Button } from '@mastra/playground-ui/components/Button';
  ```

  `mastracode` now uses the exact subpath imports, and lint rules prevent new broad `@mastra/playground-ui` imports.

- Hardened child-process invocations against shell command injection. Package installs and codemod runs now pass arguments as arrays instead of interpolating them into shell strings, the deployer's shared child-process logger rejects arguments containing shell metacharacters, and the login dialog validates auth URLs and opens the browser without a shell. As a side effect, `mastra codemod` now works on project paths containing spaces. ([#18804](https://github.com/mastra-ai/mastra/pull/18804))

- Fixed thread search shortcut conflict where pressing 'c' in the thread list search triggered the clone dialog instead of typing in the search field. Changed the clone shortcut from 'c' to Tab. ([#18746](https://github.com/mastra-ai/mastra/pull/18746))

- Security hardening from CodeQL review: MCP serverless 500 responses no longer echo internal error messages to clients (details are still logged server-side), and macOS system notifications now escape backslashes and run osascript without a shell so notification text can't inject commands. ([#18805](https://github.com/mastra-ai/mastra/pull/18805))

- Fixed GitHub plugin installs so they use GitHub CLI auth and no longer prompt inside the TUI. ([#18764](https://github.com/mastra-ai/mastra/pull/18764))

- Rebuilt the MastraCode web studio UI on the @mastra/playground-ui design system. Theme switching, settings, command palette, sidebar, and the conversation transcript now use shared design-system components for a consistent look and accessible controls, replacing the previous custom stylesheet, and the bespoke inline-SVG icon set was replaced with lucide-react icons (the decorative brand wordmark/logo was removed while preserving accessible labels). ([#18782](https://github.com/mastra-ai/mastra/pull/18782))

  Cleaned up the studio chrome: removed the duplicate top-level project switcher, theme toggle, and mode switcher from the header (the sidebar switcher is the single project switcher, the theme is set only from Settings), moved the Settings button into the sidebar footer, and moved the session mode selector into a single unified status row below the composer. The header is now reduced to just the mobile sidebar toggle. The chat message column, composer, and status line share the same `max-w-[80ch] w-full` column with container border/background removed so they align cleanly.

  Simplified the chat message UI to match the Studio playground: user messages are plain right-aligned rounded bubbles (no "YOU" label or avatar) rendered as markdown, and assistant messages render as label-free full-width markdown prose.

  Improved tool-call rendering: tool arguments, results, and full-file writes render through the design-system `CodeBlock` component (shiki highlighting, built-in copy, softer rounded shape) instead of plain monospace `<pre>` blocks. Consecutive tool calls now merge into a single bordered, rounded container with divider-separated full-width collapsible rows (no per-item stacked-card look), and the collapse control uses a standard chevron instead of a rotating icon.

  Improved the "Open a project" dialog: the current path uses the shared breadcrumb component and navigating up a folder is a single click on a parent crumb; removed the double-click-to-select behavior and hint text so a single click browses and "Use this folder" selects.

  Improved web session caching and settings refresh behavior.

- Updated dependencies [[`700619b`](https://github.com/mastra-ai/mastra/commit/700619b61d572e592cbaaf758121d168844ca4d2), [`0f69865`](https://github.com/mastra-ai/mastra/commit/0f69865aced225d98eac812e22699dc445ee18cb), [`9250acd`](https://github.com/mastra-ai/mastra/commit/9250acd1357f0f1f33d0dcca16f9655084c58eca), [`9fe9d2d`](https://github.com/mastra-ai/mastra/commit/9fe9d2d905a84409202fe222eab698216704e4e7), [`0c3d4bc`](https://github.com/mastra-ai/mastra/commit/0c3d4bcae13ea3699d379403e6f350d5cf4efe9f), [`cc440a3`](https://github.com/mastra-ai/mastra/commit/cc440a39400d8ce06655462b26c1666a1b3d4320), [`6a61846`](https://github.com/mastra-ai/mastra/commit/6a61846eeda29fb714549b70f1bee2bf6b141c44), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`17369b2`](https://github.com/mastra-ai/mastra/commit/17369b25250561e9ed994ae509be1d15bfb33bcb), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`bcae929`](https://github.com/mastra-ai/mastra/commit/bcae929945cbf265bd9f327cc715ecafa072b5b9), [`ea6327b`](https://github.com/mastra-ai/mastra/commit/ea6327ba2d63ca647804bc97b347e03a58617162), [`3439fa8`](https://github.com/mastra-ai/mastra/commit/3439fa836ecfcaa257b40c20b30ac2a8be22e9ea), [`85107f2`](https://github.com/mastra-ai/mastra/commit/85107f2758b527147fccbedff962961927c2d3b8), [`7952b3d`](https://github.com/mastra-ai/mastra/commit/7952b3d90e2437093ee322585e361ea6e62ed497), [`b33822e`](https://github.com/mastra-ai/mastra/commit/b33822e8d470884954b02f7b0745407ee4ef74b1), [`06e2680`](https://github.com/mastra-ai/mastra/commit/06e26806b51d2cbd858afdc66daa2b86ff3ba64a), [`1042cb4`](https://github.com/mastra-ai/mastra/commit/1042cb4da227c0a1315a6362262be3058866c5f8), [`06ff9e0`](https://github.com/mastra-ai/mastra/commit/06ff9e0befd1d642ab87ff749285ee4091205c7e), [`d5c11e3`](https://github.com/mastra-ai/mastra/commit/d5c11e3ba5045969caa7272a7bd1fd141c93ab6c), [`7f5e1ff`](https://github.com/mastra-ai/mastra/commit/7f5e1ff695a92f672bb3976363925d1e9136b54a), [`ff80671`](https://github.com/mastra-ai/mastra/commit/ff8067185e208b27198b4e5b71803013175c3643), [`b8375c1`](https://github.com/mastra-ai/mastra/commit/b8375c1f8fe905df8ae2ae9a893bb365f17aec4e), [`dab1257`](https://github.com/mastra-ai/mastra/commit/dab1257b64e4ed576dc5038bb7a3f7072338bc9f), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`1240f05`](https://github.com/mastra-ai/mastra/commit/1240f051c8e5371f1c014448bf37b1a1b9a05e47), [`b33822e`](https://github.com/mastra-ai/mastra/commit/b33822e8d470884954b02f7b0745407ee4ef74b1), [`df25635`](https://github.com/mastra-ai/mastra/commit/df25635b954e63b5dbf8f1636af953b95c631809), [`9ab5faa`](https://github.com/mastra-ai/mastra/commit/9ab5faaff673ee9953ab4604cec217ee57875cd5), [`705ff39`](https://github.com/mastra-ai/mastra/commit/705ff3969e57214ff2fdaf3815d751dd558886ed), [`e6fbd5b`](https://github.com/mastra-ai/mastra/commit/e6fbd5bfdc28e92c0c0433f29aa1bc152d3430f6), [`c4f43f3`](https://github.com/mastra-ai/mastra/commit/c4f43f37a6720658810c91ef3435d59941691262), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`b33822e`](https://github.com/mastra-ai/mastra/commit/b33822e8d470884954b02f7b0745407ee4ef74b1), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`65b1833`](https://github.com/mastra-ai/mastra/commit/65b1833c803356b0a33c7c865be073a92d52d74f), [`6f2026c`](https://github.com/mastra-ai/mastra/commit/6f2026cdf114ff1e21e49133ca774ec7d5085059), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`27826bc`](https://github.com/mastra-ai/mastra/commit/27826bc8ec20d6b4597ba456e506d65f45656c8f), [`0f5ebf7`](https://github.com/mastra-ai/mastra/commit/0f5ebf761bca5bb34bd13a82513a65dede006bc7), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`e8eee50`](https://github.com/mastra-ai/mastra/commit/e8eee5087937c9db1a57167119813861328e22ce), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`ff80671`](https://github.com/mastra-ai/mastra/commit/ff8067185e208b27198b4e5b71803013175c3643), [`003f35d`](https://github.com/mastra-ai/mastra/commit/003f35d19e07b23b4bacc591c8bc0c59b42124ae), [`f890eda`](https://github.com/mastra-ai/mastra/commit/f890eda2c8a2ae83d9b30bc6d85842f93b6c266b), [`1340fb7`](https://github.com/mastra-ai/mastra/commit/1340fb76262a3ca062130aa71859f07257a0a5a4)]:
  - @mastra/core@1.49.0
  - @mastra/playground-ui@39.0.0
  - @mastra/client-js@1.30.0
  - @mastra/server@1.49.0
  - @mastra/libsql@1.15.0
  - @mastra/pg@1.15.0
  - @mastra/schema-compat@1.3.3
  - @mastra/mcp@1.13.0
  - @mastra/hono@1.5.4
  - @mastra/railway@0.3.0
  - @mastra/memory@1.22.1
  - @mastra/react@1.2.2
  - @mastra/auth-workos@1.6.2

## 0.28.0-alpha.6

### Patch Changes

- Updated dependencies [[`0f5ebf7`](https://github.com/mastra-ai/mastra/commit/0f5ebf761bca5bb34bd13a82513a65dede006bc7)]:
  - @mastra/libsql@1.15.0-alpha.2
  - @mastra/pg@1.15.0-alpha.2
  - @mastra/hono@1.5.4-alpha.5

## 0.28.0-alpha.5

### Patch Changes

- Updated dependencies [[`9250acd`](https://github.com/mastra-ai/mastra/commit/9250acd1357f0f1f33d0dcca16f9655084c58eca), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`06e2680`](https://github.com/mastra-ai/mastra/commit/06e26806b51d2cbd858afdc66daa2b86ff3ba64a), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`1240f05`](https://github.com/mastra-ai/mastra/commit/1240f051c8e5371f1c014448bf37b1a1b9a05e47), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`65b1833`](https://github.com/mastra-ai/mastra/commit/65b1833c803356b0a33c7c865be073a92d52d74f), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748)]:
  - @mastra/core@1.49.0-alpha.5
  - @mastra/client-js@1.30.0-alpha.5
  - @mastra/server@1.49.0-alpha.5
  - @mastra/libsql@1.15.0-alpha.1
  - @mastra/pg@1.15.0-alpha.1
  - @mastra/playground-ui@39.0.0-alpha.5
  - @mastra/react@1.2.2-alpha.5
  - @mastra/hono@1.5.4-alpha.5

## 0.28.0-alpha.4

### Patch Changes

- Removed named exports from the `@mastra/playground-ui` root entry. Import public APIs from exact package subpaths instead. ([#18791](https://github.com/mastra-ai/mastra/pull/18791))

  **Before**

  ```ts
  import { Button } from '@mastra/playground-ui';
  ```

  **After**

  ```ts
  import { Button } from '@mastra/playground-ui/components/Button';
  ```

  `mastracode` now uses the exact subpath imports, and lint rules prevent new broad `@mastra/playground-ui` imports.

- Updated dependencies [[`6a61846`](https://github.com/mastra-ai/mastra/commit/6a61846eeda29fb714549b70f1bee2bf6b141c44), [`7952b3d`](https://github.com/mastra-ai/mastra/commit/7952b3d90e2437093ee322585e361ea6e62ed497)]:
  - @mastra/core@1.49.0-alpha.4
  - @mastra/playground-ui@38.1.0-alpha.4
  - @mastra/client-js@1.29.1-alpha.4
  - @mastra/react@1.2.2-alpha.4
  - @mastra/server@1.49.0-alpha.4
  - @mastra/hono@1.5.4-alpha.4

## 0.28.0-alpha.3

### Minor Changes

- Added lifecycle hook events and a per-run `run_id` field so external orchestrators can track agent lifecycle states directly instead of inferring them from coarse prompt, tool, and stop signals. ([#18607](https://github.com/mastra-ai/mastra/pull/18607))

  **New events:** AgentStart, AgentEnd, PermissionRequest, PermissionResult, Interrupt, SubagentStart, and SubagentEnd. All new lifecycle events are non-blocking. Existing blocking events, including PreToolUse, Stop, and UserPromptSubmit, keep their current behavior.

  Every hook stdin now includes a `run_id` during an active run. Permission decisions and interrupts only emit while a run is active, so consumers can reliably correlate them with the run that produced them.

  PostToolUse continues to fire from the agent tool hook wrapper after a tool call completes. It is not emitted from the TUI lifecycle dispatcher.

  **Why**

  External orchestrators needed first-class signals for permission gates, interrupts, and subagent delegation. The previous hook surface only offered coarse prompt, tool, and stop events, forcing integrators to guess at lifecycle state.

  ```json
  {
    "AgentStart": [{ "type": "command", "command": "echo started >> /tmp/lifecycle.log" }],
    "AgentEnd": [{ "type": "command", "command": "echo ended >> /tmp/lifecycle.log" }],
    "Interrupt": [{ "type": "command", "command": "echo interrupted >> /tmp/lifecycle.log" }]
  }
  ```

  AgentStart stdin includes the shared `run_id`:

  ```json
  { "hook_event_name": "AgentStart", "run_id": "a1b2c3d4", "session_id": "...", "cwd": "/path/to/project" }
  ```

### Patch Changes

- Hardened child-process invocations against shell command injection. Package installs and codemod runs now pass arguments as arrays instead of interpolating them into shell strings, the deployer's shared child-process logger rejects arguments containing shell metacharacters, and the login dialog validates auth URLs and opens the browser without a shell. As a side effect, `mastra codemod` now works on project paths containing spaces. ([#18804](https://github.com/mastra-ai/mastra/pull/18804))

- Security hardening from CodeQL review: MCP serverless 500 responses no longer echo internal error messages to clients (details are still logged server-side), and macOS system notifications now escape backslashes and run osascript without a shell so notification text can't inject commands. ([#18805](https://github.com/mastra-ai/mastra/pull/18805))

- Rebuilt the MastraCode web studio UI on the @mastra/playground-ui design system. Theme switching, settings, command palette, sidebar, and the conversation transcript now use shared design-system components for a consistent look and accessible controls, replacing the previous custom stylesheet, and the bespoke inline-SVG icon set was replaced with lucide-react icons (the decorative brand wordmark/logo was removed while preserving accessible labels). ([#18782](https://github.com/mastra-ai/mastra/pull/18782))

  Cleaned up the studio chrome: removed the duplicate top-level project switcher, theme toggle, and mode switcher from the header (the sidebar switcher is the single project switcher, the theme is set only from Settings), moved the Settings button into the sidebar footer, and moved the session mode selector into a single unified status row below the composer. The header is now reduced to just the mobile sidebar toggle. The chat message column, composer, and status line share the same `max-w-[80ch] w-full` column with container border/background removed so they align cleanly.

  Simplified the chat message UI to match the Studio playground: user messages are plain right-aligned rounded bubbles (no "YOU" label or avatar) rendered as markdown, and assistant messages render as label-free full-width markdown prose.

  Improved tool-call rendering: tool arguments, results, and full-file writes render through the design-system `CodeBlock` component (shiki highlighting, built-in copy, softer rounded shape) instead of plain monospace `<pre>` blocks. Consecutive tool calls now merge into a single bordered, rounded container with divider-separated full-width collapsible rows (no per-item stacked-card look), and the collapse control uses a standard chevron instead of a rotating icon.

  Improved the "Open a project" dialog: the current path uses the shared breadcrumb component and navigating up a folder is a single click on a parent crumb; removed the double-click-to-select behavior and hint text so a single click browses and "Use this folder" selects.

  Improved web session caching and settings refresh behavior.

- Updated dependencies [[`700619b`](https://github.com/mastra-ai/mastra/commit/700619b61d572e592cbaaf758121d168844ca4d2), [`9fe9d2d`](https://github.com/mastra-ai/mastra/commit/9fe9d2d905a84409202fe222eab698216704e4e7), [`0c3d4bc`](https://github.com/mastra-ai/mastra/commit/0c3d4bcae13ea3699d379403e6f350d5cf4efe9f), [`17369b2`](https://github.com/mastra-ai/mastra/commit/17369b25250561e9ed994ae509be1d15bfb33bcb), [`bcae929`](https://github.com/mastra-ai/mastra/commit/bcae929945cbf265bd9f327cc715ecafa072b5b9), [`b33822e`](https://github.com/mastra-ai/mastra/commit/b33822e8d470884954b02f7b0745407ee4ef74b1), [`d5c11e3`](https://github.com/mastra-ai/mastra/commit/d5c11e3ba5045969caa7272a7bd1fd141c93ab6c), [`ff80671`](https://github.com/mastra-ai/mastra/commit/ff8067185e208b27198b4e5b71803013175c3643), [`dab1257`](https://github.com/mastra-ai/mastra/commit/dab1257b64e4ed576dc5038bb7a3f7072338bc9f), [`b33822e`](https://github.com/mastra-ai/mastra/commit/b33822e8d470884954b02f7b0745407ee4ef74b1), [`df25635`](https://github.com/mastra-ai/mastra/commit/df25635b954e63b5dbf8f1636af953b95c631809), [`705ff39`](https://github.com/mastra-ai/mastra/commit/705ff3969e57214ff2fdaf3815d751dd558886ed), [`e6fbd5b`](https://github.com/mastra-ai/mastra/commit/e6fbd5bfdc28e92c0c0433f29aa1bc152d3430f6), [`b33822e`](https://github.com/mastra-ai/mastra/commit/b33822e8d470884954b02f7b0745407ee4ef74b1), [`6f2026c`](https://github.com/mastra-ai/mastra/commit/6f2026cdf114ff1e21e49133ca774ec7d5085059), [`27826bc`](https://github.com/mastra-ai/mastra/commit/27826bc8ec20d6b4597ba456e506d65f45656c8f), [`e8eee50`](https://github.com/mastra-ai/mastra/commit/e8eee5087937c9db1a57167119813861328e22ce), [`ff80671`](https://github.com/mastra-ai/mastra/commit/ff8067185e208b27198b4e5b71803013175c3643), [`f890eda`](https://github.com/mastra-ai/mastra/commit/f890eda2c8a2ae83d9b30bc6d85842f93b6c266b)]:
  - @mastra/core@1.49.0-alpha.3
  - @mastra/playground-ui@38.1.0-alpha.3
  - @mastra/libsql@1.15.0-alpha.0
  - @mastra/mcp@1.13.0-alpha.1
  - @mastra/server@1.49.0-alpha.3
  - @mastra/hono@1.5.4-alpha.3
  - @mastra/pg@1.15.0-alpha.0
  - @mastra/memory@1.22.1-alpha.1
  - @mastra/client-js@1.29.1-alpha.3
  - @mastra/auth-workos@1.6.2-alpha.0
  - @mastra/react@1.2.2-alpha.3

## 0.27.1-alpha.2

### Patch Changes

- Fixed GitHub plugin installs so they use GitHub CLI auth and no longer prompt inside the TUI. ([#18764](https://github.com/mastra-ai/mastra/pull/18764))

- Updated dependencies [[`c4f43f3`](https://github.com/mastra-ai/mastra/commit/c4f43f37a6720658810c91ef3435d59941691262), [`1340fb7`](https://github.com/mastra-ai/mastra/commit/1340fb76262a3ca062130aa71859f07257a0a5a4)]:
  - @mastra/railway@0.3.0-alpha.0
  - @mastra/core@1.49.0-alpha.2
  - @mastra/react@1.2.2-alpha.2
  - @mastra/server@1.49.0-alpha.2
  - @mastra/hono@1.5.4-alpha.2

## 0.27.1-alpha.1

### Patch Changes

- Fixed thread search shortcut conflict where pressing 'c' in the thread list search triggered the clone dialog instead of typing in the search field. Changed the clone shortcut from 'c' to Tab. ([#18746](https://github.com/mastra-ai/mastra/pull/18746))

- Updated dependencies [[`cc440a3`](https://github.com/mastra-ai/mastra/commit/cc440a39400d8ce06655462b26c1666a1b3d4320), [`ea6327b`](https://github.com/mastra-ai/mastra/commit/ea6327ba2d63ca647804bc97b347e03a58617162), [`3439fa8`](https://github.com/mastra-ai/mastra/commit/3439fa836ecfcaa257b40c20b30ac2a8be22e9ea), [`85107f2`](https://github.com/mastra-ai/mastra/commit/85107f2758b527147fccbedff962961927c2d3b8), [`1042cb4`](https://github.com/mastra-ai/mastra/commit/1042cb4da227c0a1315a6362262be3058866c5f8), [`06ff9e0`](https://github.com/mastra-ai/mastra/commit/06ff9e0befd1d642ab87ff749285ee4091205c7e), [`7f5e1ff`](https://github.com/mastra-ai/mastra/commit/7f5e1ff695a92f672bb3976363925d1e9136b54a), [`b8375c1`](https://github.com/mastra-ai/mastra/commit/b8375c1f8fe905df8ae2ae9a893bb365f17aec4e), [`9ab5faa`](https://github.com/mastra-ai/mastra/commit/9ab5faaff673ee9953ab4604cec217ee57875cd5), [`003f35d`](https://github.com/mastra-ai/mastra/commit/003f35d19e07b23b4bacc591c8bc0c59b42124ae)]:
  - @mastra/core@1.49.0-alpha.1
  - @mastra/schema-compat@1.3.3-alpha.0
  - @mastra/mcp@1.13.0-alpha.0
  - @mastra/memory@1.22.1-alpha.0
  - @mastra/server@1.49.0-alpha.1
  - @mastra/react@1.2.2-alpha.1
  - @mastra/hono@1.5.4-alpha.1

## 0.27.1-alpha.0

### Patch Changes

- Updated dependencies [[`0f69865`](https://github.com/mastra-ai/mastra/commit/0f69865aced225d98eac812e22699dc445ee18cb)]:
  - @mastra/core@1.48.1-alpha.0
  - @mastra/react@1.2.2-alpha.0
  - @mastra/server@1.48.1-alpha.0
  - @mastra/hono@1.5.4-alpha.0

## 0.27.0

### Minor Changes

- **Improved web settings data loading** ([#18518](https://github.com/mastra-ai/mastra/pull/18518))
  - Settings panels now avoid duplicate requests and refresh lists after saves or removals.
  - Provider keys, custom providers, model packs, observational memory, and the directory picker now stay in sync automatically.
  - Streaming chat behavior is unchanged.

- Improved push-to-talk voice input in the MastraCode TUI. Enable it with `/voice`, hold the spacebar to dictate, and release to finish — your speech streams into the input box in real time. ([#18624](https://github.com/mastra-ai/mastra/pull/18624))

  **Choose how you dictate**

  `/voice` is now an interactive settings menu. You can toggle voice on/off, pick a transcription engine, and (for cloud transcription) pick a provider and model. Run `/voice status` to see the current engine, provider/model, and whether it's ready to use. The quick toggles `/voice on` and `/voice off` still work.

  **On-device transcription on macOS**

  On macOS, voice now defaults to a native on-device engine (Apple's `SFSpeechRecognizer`). It's free, works offline, and streams words into the input box with low latency — no API key required.

  When you turn voice on, the TUI checks the macOS Microphone and Speech Recognition permissions for you and guides you through whatever is needed: if access is blocked it offers to open the exact Privacy & Security pane (and tells you to enable "MastraCode Voice" there); if macOS simply hasn't asked yet, it explains that the first time you hold space it will prompt and you should click Allow. The same guidance appears in `/voice status` and, if dictation ever fails on a permission problem, alongside the error — so you're never left guessing what to do.

  **Multiple cloud providers, not just OpenAI**

  Cloud transcription is no longer locked to OpenAI Whisper. You can pick from several providers — OpenAI, Groq and other OpenAI-compatible Whisper hosts, plus Deepgram via its own SDK — and choose a model for each. Set the matching API key via the provider's environment variable or `/api-keys`; if a key is missing, `/voice` points you to `/api-keys`.

  You still need a local audio recorder on your `PATH` for the cloud engine — `rec`/`sox` (recommended) or `ffmpeg` on macOS, and `pw-record`/`parecord`/`arecord`/`sox` on Linux. Non-macOS systems default to the cloud engine.

  **Reliability fixes**

  macOS native engine:
  - It now triggers the permission prompt and works end-to-end. The on-device recognizer ships as a proper `.app` bundle — `Contents/MacOS/<binary>` plus a generated `Contents/Info.plist` with the Speech Recognition and Microphone usage descriptions — that is ad-hoc signed (`codesign -f -s -`) so the plist binds into the signature.
  - The bundle is launched through macOS LaunchServices (`open`), the only launch path that makes macOS show the permission dialogs. A bare command-line executable — even one with an embedded, signed Info.plist — never fires `SFSpeechRecognizer.requestAuthorization`, so the Allow prompt never appeared and the recognizer was silently denied.
  - Because a LaunchServices-launched app has no stdin/stdout pipe back to the CLI, the recognizer talks to the TUI over files: it appends newline-delimited JSON events to an events file the engine tails, and the engine asks it to flush a final result and quit by writing a stop sentinel file the recognizer polls for. The engine buffers partial lines so an event split across reads is never dropped, and it lets the recognizer see the stop sentinel before tearing the process down.
  - `/voice status` does a real readiness check: it verifies the Swift toolchain and probes the actual Speech Recognition and Microphone permission state, naming exactly which one to enable in System Settings (and explaining the first-run prompt when permission hasn't been requested yet). The probe runs through the same `.app` bundle so it reads authorization under the bundle's TCC identity — probing the loose binary would query a different identity and wrongly report "not granted".
  - If the recognizer exits before it can start (suppressed prompt or TCC kill), the engine surfaces a clear, actionable error with its captured output. A not-yet-determined permission state is no longer dressed up as the cause of a real crash, so you no longer see a misleading "macOS will prompt next time" message in red. The recognizer's Swift source and plist ship with the built CLI so the bundle can be built on first use.

  Cloud engine:
  - The live-partial loop is more robust: non-overlapping ticks and de-duplicated partials, and the terminal callback always fires on stop (final transcript, empty result, or error).
  - First-dictation latency is reduced: the provider client is built once per dictation and reused across ticks so its HTTP connection stays warm (keep-alive), removing the DNS + TLS handshake cost that made the first dictation lag. The loop also polls at a short cadence until the recorder produces usable audio, so the opening partial fires as soon as there's something to transcribe.

- Reworked headless mode into a real programmatic API. You can now run MastraCode from Node/CI code with `runMC({ controller, session, prompt })`, which returns a handle that streams live events as an async-iterable and resolves to a typed result with status, text, usage, tool calls, and an exit code — it never calls `process.exit` or writes to global streams. The CLI is now a thin adapter over the same runner. ([#18680](https://github.com/mastra-ai/mastra/pull/18680))

  ```ts
  import { createMastraCode, runMC } from 'mastracode';

  const { controller, session } = await createMastraCode({ settingsPath });

  const run = runMC({ controller, session, prompt: 'Fix the failing test' });
  for await (const event of run) {
    // optional: react to live progress events
  }
  const result = await run.result;
  process.exitCode = result.exitCode; // 0 success, 1 error/aborted/max-turns, 2 timeout
  ```

  Approvals and suspensions are resolved by a pluggable policy (default keeps the previous auto-approve behavior); a built-in `denyPolicy` plus `permissionModeToPolicy` are exported, and a new `--permission-mode {auto|deny}` flag selects between them. A new `--max-turns` flag (and `maxTurns` option) caps assistant turns and reports a `max_turns` status with exit code 1 when the cap is hit mid-task.

  Breaking changes / migration:
  - Output flags consolidated: the `--format` and `--output-format` flags are replaced by a single `--output` flag with values `human`, `json`, or `jsonl`.
    - Before: `mastracode --prompt "..." --output-format json`
    - After: `mastracode --prompt "..." --output json`
  - Programmatic entry point changed from the old `runHeadless`/`headlessMain` to `runMC` (pure runner) and `runMCCli` (CLI adapter). `runMC` takes an already-built `controller` + `session` from `createMastraCode` and returns a result object instead of only an exit code.

- Added Amazon Bedrock as a model provider in Mastra Code. Bedrock models surfaced by models.dev are now selectable via `/models` and usable as build/plan/fast or subagent models with the `amazon-bedrock/<modelId>` form. Models are only offered when AWS credentials are detected. ([#17937](https://github.com/mastra-ai/mastra/pull/17937))

  Bedrock authenticates with AWS SigV4 through the standard AWS credential chain (`fromNodeProviderChain`), so environment variables, shared `~/.aws` profiles, SSO, and container/instance roles all work without extra configuration. Set `AWS_REGION` (defaults to `us-east-1`) to target a region, or `AWS_BEARER_TOKEN_BEDROCK` to use Bedrock API-key auth instead.

  ```sh
  # Pick a Bedrock model from the picker
  /models

  # Or set it directly via the build/plan/fast slots
  /build amazon-bedrock/<modelId>
  ```

- Turned MastraCode Web into a multi-org cloud coding service. When WorkOS auth and a GitHub App are configured, a team can sign in, connect their repos, and run coding agents that branch, commit, push, and open pull requests — all from isolated cloud sandboxes. When the relevant environment variables are absent, the server and UI behave exactly as before (local-path projects, single shared store, no auth UI), so this is fully opt-in. ([#18567](https://github.com/mastra-ai/mastra/pull/18567))

  **Authentication (WorkOS AuthKit).** Setting `WORKOS_API_KEY` and `WORKOS_CLIENT_ID` protects every route: unauthenticated visitors are redirected to the WorkOS hosted login, signed-in users get an encrypted session, expired sessions bounce back to login, and the sidebar shows the signed-in email with a Sign out button. Users with no WorkOS organization get a personal org bootstrapped on first authenticated use (idempotent, with recovery from partial creations), so personal accounts can use org-scoped features without hand-creating an org.

  **Org-owned GitHub projects.** With the GitHub App env vars set (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_SLUG`, `APP_DATABASE_URL`), users install/connect the app, pick repos they can access, and turn each into a project. The installation and connected repos belong to the WorkOS organization; the same repo can be connected independently by different orgs with no cross-visibility. Each repo is materialized into an isolated cloud sandbox on open — cloned (or pulled) inside the sandbox with a short-lived installation token that never reaches the browser and is scrubbed from the remote afterward.

  **Cloud coding-agent write-back.** From a connected repo, each user gets their own sandbox, git worktrees, and feature branches. The agent runs against the selected worktree (file edits and commands bind to its path) and can commit, push, and open pull requests via the in-sandbox `gh` CLI, authenticated with short-lived per-operation installation tokens. The sidebar shows a nested project → worktree → conversations tree with a "+ New worktree" affordance; conversations scope per worktree.

  **Sandbox providers.** A provider is selected automatically: Railway when `RAILWAY_API_TOKEN` is set, otherwise a local provider that runs git directly on the host (single-user local dev only — no tenant isolation). `MASTRACODE_SANDBOX_PROVIDER` overrides explicitly. Idle sandboxes are torn down and re-provisioned on the next open; a per-replica live-sandbox cap (`MASTRACODE_MAX_SANDBOXES`) and a per-user teardown route bound resource use.

  **Per-(org,user) state isolation.** Agent state (threads, messages, memory, recall vectors) is isolated by the `(organization, user)` pair, each backed by a dedicated libSQL database whose location is derived server-side from a hash of `(orgId, userId)` — never a client-supplied path. By default each tenant gets local libSQL files under `MASTRACODE_TENANT_DB_ROOT`; for hosted deployments, point each tenant at a remote libSQL/Turso database via `MASTRACODE_TENANT_DB_URL_TEMPLATE` (plus optional vector template and auth tokens).

  **Sandbox isolation hardening.** Commands run in the local sandbox receive only a sanitized allow-list of environment variables (PATH/HOME/locale/git config), so server secrets such as `GITHUB_APP_PRIVATE_KEY`, `WORKOS_API_KEY`, and `APP_DATABASE_URL` are never exposed to code running against an untrusted checkout. Sandbox filesystem write operations (write/append/copy/move/mkdir) now verify the destination's real path — including a symlinked parent directory — stays within the workspace root, preventing a malicious repo's symlink from redirecting writes outside the sandbox.

  **Multi-replica deployment hardening.** Per-(project,user) git writes are serialized across replicas with Postgres advisory locks (`MASTRACODE_DISTRIBUTED_LOCK`, on by default; requires `APP_DATABASE_URL`). OAuth/install state signing requires a replica-stable secret in multi-replica setups, in-memory tenant stacks are evicted by idle timeout and an LRU cap (`MASTRACODE_TENANT_IDLE_MINUTES`, `MASTRACODE_TENANT_MAX_APPS`), and `MASTRACODE_REQUIRE_REMOTE_TENANT_DB=1` fails startup when no shared remote tenant DB is configured.

  ```bash
  # Auth + GitHub App (opt-in)
  WORKOS_API_KEY=sk_xxxxxxxx
  WORKOS_CLIENT_ID=client_xxxxxxxx
  GITHUB_APP_ID=123456
  GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
  GITHUB_APP_CLIENT_ID=Iv1.xxxxxxxx
  GITHUB_APP_CLIENT_SECRET=xxxxxxxx
  GITHUB_APP_SLUG=your-app-slug
  APP_DATABASE_URL=postgres://user:pass@host:5432/mastracode_web

  # Multi-replica hosted deployment
  GITHUB_APP_WEBHOOK_SECRET=...                      # replica-stable state signing
  MASTRACODE_DISTRIBUTED_LOCK=1                       # cross-replica git write locks
  MASTRACODE_REQUIRE_REMOTE_TENANT_DB=1              # require shared remote tenant DBs
  MASTRACODE_TENANT_DB_URL_TEMPLATE=libsql://{id}-org.turso.io
  MASTRACODE_TENANT_IDLE_MINUTES=30
  MASTRACODE_TENANT_MAX_APPS=100
  MASTRACODE_MAX_SANDBOXES=50
  ```

  Still deferred: collaboration within a project (multiple users sharing one worktree/sandbox/branch), org admin/roles and membership management, and org-level project deletion.

- Auto-provision a per-tenant Turso database in deployed MastraCode Web environments. ([#18690](https://github.com/mastra-ai/mastra/pull/18690))

  Previously, hosting per-`(org, user)` agent state on Turso required each tenant's database to already exist at the URL produced by `MASTRACODE_TENANT_DB_URL_TEMPLATE`. There was no way to create those databases on demand, so the only zero-setup option was server-local libSQL files — which are ephemeral and not shared across replicas.

  Setting `MASTRACODE_TURSO_PLATFORM_TOKEN` and `MASTRACODE_TURSO_ORG` now enables a third tenant-storage mode: the first time a tenant is seen, its own Turso database is created via the Turso Platform API (idempotent — an "already exists" race recovers the hostname via `databases.get`), a scoped auth token is minted, and the stable database-name/hostname mapping is persisted in the app Postgres (`tenant_databases` table, requires `APP_DATABASE_URL`). All replicas converge on the same database and cold starts never re-create it. Only the durable mapping is stored; the auth token is minted fresh per resolution, so no long-lived credential is persisted.

  Resolution priority is: explicit `MASTRACODE_TENANT_DB_URL_TEMPLATE` → Turso auto-provisioning → local libSQL files. Turso provisioning also satisfies `MASTRACODE_REQUIRE_REMOTE_TENANT_DB=1`. The `@tursodatabase/api` client is loaded dynamically, so deployments that don't use Turso never pull it in at runtime.

  ```bash
  MASTRACODE_TURSO_PLATFORM_TOKEN=...    # Turso Platform API token
  MASTRACODE_TURSO_ORG=my-org            # org that owns provisioned databases
  MASTRACODE_TURSO_GROUP=default         # optional group (default "default")
  APP_DATABASE_URL=postgres://...        # required for the mapping table
  ```

### Patch Changes

- Renamed the AgentController interval API. `heartbeatHandlers` is now `intervalHandlers`, the `HeartbeatHandler` type is now `IntervalHandler`, and the `removeHeartbeat()`/`stopHeartbeats()` methods are now `removeInterval()`/`stopIntervals()`. This better reflects that these are fixed-interval background tasks, not liveness pings, and is distinct from the unrelated `mastra.heartbeats` scheduled-agent feature. ([#18665](https://github.com/mastra-ai/mastra/pull/18665))

  **Before**

  ```ts
  const { controller } = await createMastraCode({
    heartbeatHandlers: [{ id: 'sync', intervalMs: 60_000, handler: async () => {} }],
  });
  await controller.removeHeartbeat({ id: 'sync' });
  await controller.stopHeartbeats();
  ```

  **After**

  ```ts
  const { controller } = await createMastraCode({
    intervalHandlers: [{ id: 'sync', intervalMs: 60_000, handler: async () => {} }],
  });
  await controller.removeInterval({ id: 'sync' });
  await controller.stopIntervals();
  ```

- Set goal judge `maxSteps` to 1000 (matching the main agent) so the judge has ample budget for complex goals requiring heavy verification. ([#18544](https://github.com/mastra-ai/mastra/pull/18544))

- Amazon Bedrock models now appear under their own `amazon-bedrock/<model>` provider in the model picker instead of the `mastracode/amazon-bedrock/<model>` namespace. Bedrock is resolved through a dedicated Amazon Bedrock gateway that authenticates with the AWS credential chain (SigV4) and surfaces models from the public models.dev catalog. Saved model selections using the previous `mastracode/amazon-bedrock/...` IDs are still resolved at runtime, so existing config keeps working. ([#17937](https://github.com/mastra-ai/mastra/pull/17937))

- MastraCode now builds its code agent through the new `createCodingAgent` factory from `@mastra/core/coding-agent` instead of constructing the `Agent` inline. No user-facing behavior changes — the system prompt and agent configuration are unchanged. ([#18695](https://github.com/mastra-ai/mastra/pull/18695))

- Fixed MCP HTTP server URLs so `${VAR}` references resolve from the environment, the same way header values already do. A server configured with `"url": "${MCP_SERVER_URL}"` is now connected instead of being silently skipped as an invalid URL. ([#18579](https://github.com/mastra-ai/mastra/pull/18579))

- MCP stdio servers now resolve `${VAR}` references in their `env` values from the host environment, matching the existing behavior for HTTP server headers. You can reference secrets from the environment instead of hardcoding them in `mcp.json`: ([#18529](https://github.com/mastra-ai/mastra/pull/18529))

  ```json
  {
    "mcpServers": {
      "github": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
      }
    }
  }
  ```

- Improved the Mastra Code status area to show active work time, completed work duration, and idle time. ([#18656](https://github.com/mastra-ai/mastra/pull/18656))

- Improved MastraCode web chat so hydrated and streaming messages render consistently, including tool cards, reasoning, and failed-tool states. ([#18620](https://github.com/mastra-ai/mastra/pull/18620))

- Added Mastra Code plugin support: ([#18658](https://github.com/mastra-ai/mastra/pull/18658))
  - Install, scaffold, configure, block, and auto-update plugins with local-change backups.
  - Load plugin tools in all modes, including streaming progress and subagent-style rendering.
  - Load bundled plugin commands, skills, and plugin-provided system instructions.

  Example:

  ```ts
  import { createTool, defineMastraCodePlugin, z } from 'mastracode/plugin';

  export default defineMastraCodePlugin({
    id: 'acme.tools',
    tools: {
      echo: {
        tool: createTool({
          id: 'echo',
          inputSchema: z.object({ message: z.string() }),
          execute: async ({ message }) => ({ message }),
        }),
      },
    },
  });
  ```

- Updated dependencies [[`b9a2961`](https://github.com/mastra-ai/mastra/commit/b9a2961c1be81e3639c0879e58588c26dd0ae866), [`b33c77d`](https://github.com/mastra-ai/mastra/commit/b33c77d5293f14a794f3ec38dc947a6676de2764), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`cdd5f93`](https://github.com/mastra-ai/mastra/commit/cdd5f939cefa67390629704dce92563ccbf492b2), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`0ac14ce`](https://github.com/mastra-ai/mastra/commit/0ac14cea48e1b0a7857782153c78f7242fdf7e1a), [`9566d27`](https://github.com/mastra-ai/mastra/commit/9566d27ead3d95bdbe5a69e5a082a68222829cf2), [`8be63b0`](https://github.com/mastra-ai/mastra/commit/8be63b015fb8d72cea1220f05e7dc3bb997cc249), [`1009f77`](https://github.com/mastra-ai/mastra/commit/1009f772aa40016b49267c8566d0c29f6a16aa3c), [`1b8728a`](https://github.com/mastra-ai/mastra/commit/1b8728a57fd844205a452b0b4216d20ff60c784a), [`23c31de`](https://github.com/mastra-ai/mastra/commit/23c31de96ed8153402dcf092ac84b27a0c3638c1), [`0368766`](https://github.com/mastra-ai/mastra/commit/0368766744c7ea3df4d6059e2cc15f7bdf55f5a6), [`d0702ee`](https://github.com/mastra-ai/mastra/commit/d0702eedc1594cb2d0d83476440cfc2ec8820adb), [`9feeaa0`](https://github.com/mastra-ai/mastra/commit/9feeaa0f9a1af07039e5b4f22b932b0cb18617e8), [`0969845`](https://github.com/mastra-ai/mastra/commit/09698454036771547961c6d0776e8ee5c6462d4f), [`6f578ac`](https://github.com/mastra-ai/mastra/commit/6f578acba84930b406b2a0700b17cfdfaf5aae56), [`ee14cae`](https://github.com/mastra-ai/mastra/commit/ee14cae244805783bde518a6142de28b744b169c), [`e05dade`](https://github.com/mastra-ai/mastra/commit/e05dade21c3e2551893ad939e6028cdafd84a1b2), [`345eecc`](https://github.com/mastra-ai/mastra/commit/345eecce6ba519b5d987f0e10b5de4c8e5734580), [`1917c53`](https://github.com/mastra-ai/mastra/commit/1917c53b19dac43926f29c496893b0686462dca4), [`c01012f`](https://github.com/mastra-ai/mastra/commit/c01012f50368d29eb3fc3764df42d48291973d23), [`705ba98`](https://github.com/mastra-ai/mastra/commit/705ba98726d388a596e896225f237907ca6807a9), [`95857bc`](https://github.com/mastra-ai/mastra/commit/95857bcd6669da7193f503e803f0d72a2bd66be6), [`e62c108`](https://github.com/mastra-ai/mastra/commit/e62c108409dfd6a6cac0a48ec39c5cc81d24fd52), [`c607ece`](https://github.com/mastra-ai/mastra/commit/c607eceeda028a80b24d00ee7dae376db73df526), [`65a66db`](https://github.com/mastra-ai/mastra/commit/65a66dbe249a0d92d828c605b955e73a983cf3b0), [`2866f04`](https://github.com/mastra-ai/mastra/commit/2866f04953edb78c1637fa45cc53abe24122edcb), [`ee14cae`](https://github.com/mastra-ai/mastra/commit/ee14cae244805783bde518a6142de28b744b169c), [`e84e791`](https://github.com/mastra-ai/mastra/commit/e84e79174031d7bc8793ca6c805eb38b06e7cfb1), [`c2f0b7f`](https://github.com/mastra-ai/mastra/commit/c2f0b7f1370f4428d165f51f0d1d9a48331cc257), [`213feb8`](https://github.com/mastra-ai/mastra/commit/213feb87bfdd1d8ec00ea660e218f9bcfcb34e7b), [`9eefdc0`](https://github.com/mastra-ai/mastra/commit/9eefdc0ac03f989718c6d835334940a977938895), [`58e287b`](https://github.com/mastra-ai/mastra/commit/58e287b1edaf978b13745a1795989cad3826e82b), [`e420b3c`](https://github.com/mastra-ai/mastra/commit/e420b3c3ffc98bbc5b791897ea390bb47af99696), [`be875ed`](https://github.com/mastra-ai/mastra/commit/be875ed43f856742ce58529f531b5ea0ae6911f3), [`9eefdc0`](https://github.com/mastra-ai/mastra/commit/9eefdc0ac03f989718c6d835334940a977938895), [`bfbbb01`](https://github.com/mastra-ai/mastra/commit/bfbbb01bd845ba54cdc0c678c277d08a7cb847e4), [`7d112ca`](https://github.com/mastra-ai/mastra/commit/7d112ca17078479b2659b88ba1c85b936cfc111c)]:
  - @mastra/core@1.48.0
  - @mastra/schema-compat@1.3.2
  - @mastra/railway@0.2.1
  - @mastra/memory@1.22.0
  - @mastra/server@1.48.0
  - @mastra/mcp@1.12.1
  - @mastra/libsql@1.14.3
  - @mastra/pg@1.14.3
  - @mastra/react@1.2.1
  - @mastra/hono@1.5.3

## 0.27.0-alpha.10

### Patch Changes

- Improved the Mastra Code status area to show active work time, completed work duration, and idle time. ([#18656](https://github.com/mastra-ai/mastra/pull/18656))

- Added Mastra Code plugin support: ([#18658](https://github.com/mastra-ai/mastra/pull/18658))
  - Install, scaffold, configure, block, and auto-update plugins with local-change backups.
  - Load plugin tools in all modes, including streaming progress and subagent-style rendering.
  - Load bundled plugin commands, skills, and plugin-provided system instructions.

  Example:

  ```ts
  import { createTool, defineMastraCodePlugin, z } from 'mastracode/plugin';

  export default defineMastraCodePlugin({
    id: 'acme.tools',
    tools: {
      echo: {
        tool: createTool({
          id: 'echo',
          inputSchema: z.object({ message: z.string() }),
          execute: async ({ message }) => ({ message }),
        }),
      },
    },
  });
  ```

- Updated dependencies [[`6f578ac`](https://github.com/mastra-ai/mastra/commit/6f578acba84930b406b2a0700b17cfdfaf5aae56), [`c01012f`](https://github.com/mastra-ai/mastra/commit/c01012f50368d29eb3fc3764df42d48291973d23), [`9eefdc0`](https://github.com/mastra-ai/mastra/commit/9eefdc0ac03f989718c6d835334940a977938895), [`be875ed`](https://github.com/mastra-ai/mastra/commit/be875ed43f856742ce58529f531b5ea0ae6911f3), [`9eefdc0`](https://github.com/mastra-ai/mastra/commit/9eefdc0ac03f989718c6d835334940a977938895), [`7d112ca`](https://github.com/mastra-ai/mastra/commit/7d112ca17078479b2659b88ba1c85b936cfc111c)]:
  - @mastra/memory@1.22.0-alpha.3
  - @mastra/core@1.48.0-alpha.10
  - @mastra/server@1.48.0-alpha.10
  - @mastra/libsql@1.14.3-alpha.0
  - @mastra/pg@1.14.3-alpha.0
  - @mastra/hono@1.5.3-alpha.10
  - @mastra/react@1.2.1-alpha.10

## 0.27.0-alpha.9

### Patch Changes

- Updated dependencies [[`e84e791`](https://github.com/mastra-ai/mastra/commit/e84e79174031d7bc8793ca6c805eb38b06e7cfb1)]:
  - @mastra/core@1.48.0-alpha.9
  - @mastra/react@1.2.1-alpha.9
  - @mastra/server@1.48.0-alpha.9
  - @mastra/hono@1.5.3-alpha.9

## 0.27.0-alpha.8

### Patch Changes

- MastraCode now builds its code agent through the new `createCodingAgent` factory from `@mastra/core/coding-agent` instead of constructing the `Agent` inline. No user-facing behavior changes — the system prompt and agent configuration are unchanged. ([#18695](https://github.com/mastra-ai/mastra/pull/18695))

- Updated dependencies [[`0ac14ce`](https://github.com/mastra-ai/mastra/commit/0ac14cea48e1b0a7857782153c78f7242fdf7e1a), [`c2f0b7f`](https://github.com/mastra-ai/mastra/commit/c2f0b7f1370f4428d165f51f0d1d9a48331cc257)]:
  - @mastra/core@1.48.0-alpha.8
  - @mastra/react@1.2.1-alpha.8
  - @mastra/server@1.48.0-alpha.8
  - @mastra/hono@1.5.3-alpha.8

## 0.27.0-alpha.7

### Minor Changes

- Reworked headless mode into a real programmatic API. You can now run MastraCode from Node/CI code with `runMC({ controller, session, prompt })`, which returns a handle that streams live events as an async-iterable and resolves to a typed result with status, text, usage, tool calls, and an exit code — it never calls `process.exit` or writes to global streams. The CLI is now a thin adapter over the same runner. ([#18680](https://github.com/mastra-ai/mastra/pull/18680))

  ```ts
  import { createMastraCode, runMC } from 'mastracode';

  const { controller, session } = await createMastraCode({ settingsPath });

  const run = runMC({ controller, session, prompt: 'Fix the failing test' });
  for await (const event of run) {
    // optional: react to live progress events
  }
  const result = await run.result;
  process.exitCode = result.exitCode; // 0 success, 1 error/aborted/max-turns, 2 timeout
  ```

  Approvals and suspensions are resolved by a pluggable policy (default keeps the previous auto-approve behavior); a built-in `denyPolicy` plus `permissionModeToPolicy` are exported, and a new `--permission-mode {auto|deny}` flag selects between them. A new `--max-turns` flag (and `maxTurns` option) caps assistant turns and reports a `max_turns` status with exit code 1 when the cap is hit mid-task.

  Breaking changes / migration:
  - Output flags consolidated: the `--format` and `--output-format` flags are replaced by a single `--output` flag with values `human`, `json`, or `jsonl`.
    - Before: `mastracode --prompt "..." --output-format json`
    - After: `mastracode --prompt "..." --output json`
  - Programmatic entry point changed from the old `runHeadless`/`headlessMain` to `runMC` (pure runner) and `runMCCli` (CLI adapter). `runMC` takes an already-built `controller` + `session` from `createMastraCode` and returns a result object instead of only an exit code.

- Turned MastraCode Web into a multi-org cloud coding service. When WorkOS auth and a GitHub App are configured, a team can sign in, connect their repos, and run coding agents that branch, commit, push, and open pull requests — all from isolated cloud sandboxes. When the relevant environment variables are absent, the server and UI behave exactly as before (local-path projects, single shared store, no auth UI), so this is fully opt-in. ([#18567](https://github.com/mastra-ai/mastra/pull/18567))

  **Authentication (WorkOS AuthKit).** Setting `WORKOS_API_KEY` and `WORKOS_CLIENT_ID` protects every route: unauthenticated visitors are redirected to the WorkOS hosted login, signed-in users get an encrypted session, expired sessions bounce back to login, and the sidebar shows the signed-in email with a Sign out button. Users with no WorkOS organization get a personal org bootstrapped on first authenticated use (idempotent, with recovery from partial creations), so personal accounts can use org-scoped features without hand-creating an org.

  **Org-owned GitHub projects.** With the GitHub App env vars set (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_SLUG`, `APP_DATABASE_URL`), users install/connect the app, pick repos they can access, and turn each into a project. The installation and connected repos belong to the WorkOS organization; the same repo can be connected independently by different orgs with no cross-visibility. Each repo is materialized into an isolated cloud sandbox on open — cloned (or pulled) inside the sandbox with a short-lived installation token that never reaches the browser and is scrubbed from the remote afterward.

  **Cloud coding-agent write-back.** From a connected repo, each user gets their own sandbox, git worktrees, and feature branches. The agent runs against the selected worktree (file edits and commands bind to its path) and can commit, push, and open pull requests via the in-sandbox `gh` CLI, authenticated with short-lived per-operation installation tokens. The sidebar shows a nested project → worktree → conversations tree with a "+ New worktree" affordance; conversations scope per worktree.

  **Sandbox providers.** A provider is selected automatically: Railway when `RAILWAY_API_TOKEN` is set, otherwise a local provider that runs git directly on the host (single-user local dev only — no tenant isolation). `MASTRACODE_SANDBOX_PROVIDER` overrides explicitly. Idle sandboxes are torn down and re-provisioned on the next open; a per-replica live-sandbox cap (`MASTRACODE_MAX_SANDBOXES`) and a per-user teardown route bound resource use.

  **Per-(org,user) state isolation.** Agent state (threads, messages, memory, recall vectors) is isolated by the `(organization, user)` pair, each backed by a dedicated libSQL database whose location is derived server-side from a hash of `(orgId, userId)` — never a client-supplied path. By default each tenant gets local libSQL files under `MASTRACODE_TENANT_DB_ROOT`; for hosted deployments, point each tenant at a remote libSQL/Turso database via `MASTRACODE_TENANT_DB_URL_TEMPLATE` (plus optional vector template and auth tokens).

  **Sandbox isolation hardening.** Commands run in the local sandbox receive only a sanitized allow-list of environment variables (PATH/HOME/locale/git config), so server secrets such as `GITHUB_APP_PRIVATE_KEY`, `WORKOS_API_KEY`, and `APP_DATABASE_URL` are never exposed to code running against an untrusted checkout. Sandbox filesystem write operations (write/append/copy/move/mkdir) now verify the destination's real path — including a symlinked parent directory — stays within the workspace root, preventing a malicious repo's symlink from redirecting writes outside the sandbox.

  **Multi-replica deployment hardening.** Per-(project,user) git writes are serialized across replicas with Postgres advisory locks (`MASTRACODE_DISTRIBUTED_LOCK`, on by default; requires `APP_DATABASE_URL`). OAuth/install state signing requires a replica-stable secret in multi-replica setups, in-memory tenant stacks are evicted by idle timeout and an LRU cap (`MASTRACODE_TENANT_IDLE_MINUTES`, `MASTRACODE_TENANT_MAX_APPS`), and `MASTRACODE_REQUIRE_REMOTE_TENANT_DB=1` fails startup when no shared remote tenant DB is configured.

  ```bash
  # Auth + GitHub App (opt-in)
  WORKOS_API_KEY=sk_xxxxxxxx
  WORKOS_CLIENT_ID=client_xxxxxxxx
  GITHUB_APP_ID=123456
  GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
  GITHUB_APP_CLIENT_ID=Iv1.xxxxxxxx
  GITHUB_APP_CLIENT_SECRET=xxxxxxxx
  GITHUB_APP_SLUG=your-app-slug
  APP_DATABASE_URL=postgres://user:pass@host:5432/mastracode_web

  # Multi-replica hosted deployment
  GITHUB_APP_WEBHOOK_SECRET=...                      # replica-stable state signing
  MASTRACODE_DISTRIBUTED_LOCK=1                       # cross-replica git write locks
  MASTRACODE_REQUIRE_REMOTE_TENANT_DB=1              # require shared remote tenant DBs
  MASTRACODE_TENANT_DB_URL_TEMPLATE=libsql://{id}-org.turso.io
  MASTRACODE_TENANT_IDLE_MINUTES=30
  MASTRACODE_TENANT_MAX_APPS=100
  MASTRACODE_MAX_SANDBOXES=50
  ```

  Still deferred: collaboration within a project (multiple users sharing one worktree/sandbox/branch), org admin/roles and membership management, and org-level project deletion.

- Auto-provision a per-tenant Turso database in deployed MastraCode Web environments. ([#18690](https://github.com/mastra-ai/mastra/pull/18690))

  Previously, hosting per-`(org, user)` agent state on Turso required each tenant's database to already exist at the URL produced by `MASTRACODE_TENANT_DB_URL_TEMPLATE`. There was no way to create those databases on demand, so the only zero-setup option was server-local libSQL files — which are ephemeral and not shared across replicas.

  Setting `MASTRACODE_TURSO_PLATFORM_TOKEN` and `MASTRACODE_TURSO_ORG` now enables a third tenant-storage mode: the first time a tenant is seen, its own Turso database is created via the Turso Platform API (idempotent — an "already exists" race recovers the hostname via `databases.get`), a scoped auth token is minted, and the stable database-name/hostname mapping is persisted in the app Postgres (`tenant_databases` table, requires `APP_DATABASE_URL`). All replicas converge on the same database and cold starts never re-create it. Only the durable mapping is stored; the auth token is minted fresh per resolution, so no long-lived credential is persisted.

  Resolution priority is: explicit `MASTRACODE_TENANT_DB_URL_TEMPLATE` → Turso auto-provisioning → local libSQL files. Turso provisioning also satisfies `MASTRACODE_REQUIRE_REMOTE_TENANT_DB=1`. The `@tursodatabase/api` client is loaded dynamically, so deployments that don't use Turso never pull it in at runtime.

  ```bash
  MASTRACODE_TURSO_PLATFORM_TOKEN=...    # Turso Platform API token
  MASTRACODE_TURSO_ORG=my-org            # org that owns provisioned databases
  MASTRACODE_TURSO_GROUP=default         # optional group (default "default")
  APP_DATABASE_URL=postgres://...        # required for the mapping table
  ```

### Patch Changes

- Updated dependencies [[`8be63b0`](https://github.com/mastra-ai/mastra/commit/8be63b015fb8d72cea1220f05e7dc3bb997cc249), [`ee14cae`](https://github.com/mastra-ai/mastra/commit/ee14cae244805783bde518a6142de28b744b169c), [`345eecc`](https://github.com/mastra-ai/mastra/commit/345eecce6ba519b5d987f0e10b5de4c8e5734580), [`ee14cae`](https://github.com/mastra-ai/mastra/commit/ee14cae244805783bde518a6142de28b744b169c)]:
  - @mastra/core@1.48.0-alpha.7
  - @mastra/server@1.48.0-alpha.7
  - @mastra/hono@1.5.3-alpha.7
  - @mastra/react@1.2.1-alpha.7

## 0.27.0-alpha.6

### Patch Changes

- Renamed the AgentController interval API. `heartbeatHandlers` is now `intervalHandlers`, the `HeartbeatHandler` type is now `IntervalHandler`, and the `removeHeartbeat()`/`stopHeartbeats()` methods are now `removeInterval()`/`stopIntervals()`. This better reflects that these are fixed-interval background tasks, not liveness pings, and is distinct from the unrelated `mastra.heartbeats` scheduled-agent feature. ([#18665](https://github.com/mastra-ai/mastra/pull/18665))

  **Before**

  ```ts
  const { controller } = await createMastraCode({
    heartbeatHandlers: [{ id: 'sync', intervalMs: 60_000, handler: async () => {} }],
  });
  await controller.removeHeartbeat({ id: 'sync' });
  await controller.stopHeartbeats();
  ```

  **After**

  ```ts
  const { controller } = await createMastraCode({
    intervalHandlers: [{ id: 'sync', intervalMs: 60_000, handler: async () => {} }],
  });
  await controller.removeInterval({ id: 'sync' });
  await controller.stopIntervals();
  ```

- Improved MastraCode web chat so hydrated and streaming messages render consistently, including tool cards, reasoning, and failed-tool states. ([#18620](https://github.com/mastra-ai/mastra/pull/18620))

- Updated dependencies [[`b33c77d`](https://github.com/mastra-ai/mastra/commit/b33c77d5293f14a794f3ec38dc947a6676de2764), [`1009f77`](https://github.com/mastra-ai/mastra/commit/1009f772aa40016b49267c8566d0c29f6a16aa3c), [`23c31de`](https://github.com/mastra-ai/mastra/commit/23c31de96ed8153402dcf092ac84b27a0c3638c1), [`0368766`](https://github.com/mastra-ai/mastra/commit/0368766744c7ea3df4d6059e2cc15f7bdf55f5a6), [`d0702ee`](https://github.com/mastra-ai/mastra/commit/d0702eedc1594cb2d0d83476440cfc2ec8820adb), [`65a66db`](https://github.com/mastra-ai/mastra/commit/65a66dbe249a0d92d828c605b955e73a983cf3b0), [`2866f04`](https://github.com/mastra-ai/mastra/commit/2866f04953edb78c1637fa45cc53abe24122edcb)]:
  - @mastra/core@1.48.0-alpha.6
  - @mastra/schema-compat@1.3.2-alpha.1
  - @mastra/mcp@1.12.1-alpha.0
  - @mastra/react@1.2.1-alpha.6
  - @mastra/memory@1.21.3-alpha.2
  - @mastra/server@1.48.0-alpha.6
  - @mastra/hono@1.5.3-alpha.6

## 0.27.0-alpha.5

### Patch Changes

- Updated dependencies [[`1917c53`](https://github.com/mastra-ai/mastra/commit/1917c53b19dac43926f29c496893b0686462dca4), [`c607ece`](https://github.com/mastra-ai/mastra/commit/c607eceeda028a80b24d00ee7dae376db73df526), [`58e287b`](https://github.com/mastra-ai/mastra/commit/58e287b1edaf978b13745a1795989cad3826e82b)]:
  - @mastra/core@1.48.0-alpha.5
  - @mastra/server@1.48.0-alpha.5
  - @mastra/memory@1.21.3-alpha.1
  - @mastra/hono@1.5.3-alpha.5

## 0.27.0-alpha.4

### Minor Changes

- Added voice input to the MastraCode TUI. Enable it with /voice, then hold the spacebar to dictate a prompt and release to finish. Your speech streams into the input in real time as you talk and is transcribed with OpenAI Whisper. The setting persists across restarts. ([#18624](https://github.com/mastra-ai/mastra/pull/18624))

  Requires an OpenAI API key (set `OPENAI_API_KEY` or configure it via `/api-keys`) and a local audio recorder on your `PATH` — `rec`/`sox` (recommended for live streaming) or `ffmpeg` on macOS, and `pw-record`/`parecord`/`arecord`/`sox` on Linux.

- Added Amazon Bedrock as a model provider in Mastra Code. Bedrock models surfaced by models.dev are now selectable via `/models` and usable as build/plan/fast or subagent models with the `amazon-bedrock/<modelId>` form. Models are only offered when AWS credentials are detected. ([#17937](https://github.com/mastra-ai/mastra/pull/17937))

  Bedrock authenticates with AWS SigV4 through the standard AWS credential chain (`fromNodeProviderChain`), so environment variables, shared `~/.aws` profiles, SSO, and container/instance roles all work without extra configuration. Set `AWS_REGION` (defaults to `us-east-1`) to target a region, or `AWS_BEARER_TOKEN_BEDROCK` to use Bedrock API-key auth instead.

  ```sh
  # Pick a Bedrock model from the picker
  /models

  # Or set it directly via the build/plan/fast slots
  /build amazon-bedrock/<modelId>
  ```

### Patch Changes

- Amazon Bedrock models now appear under their own `amazon-bedrock/<model>` provider in the model picker instead of the `mastracode/amazon-bedrock/<model>` namespace. Bedrock is resolved through a dedicated Amazon Bedrock gateway that authenticates with the AWS credential chain (SigV4) and surfaces models from the public models.dev catalog. Saved model selections using the previous `mastracode/amazon-bedrock/...` IDs are still resolved at runtime, so existing config keeps working. ([#17937](https://github.com/mastra-ai/mastra/pull/17937))

- Updated dependencies [[`705ba98`](https://github.com/mastra-ai/mastra/commit/705ba98726d388a596e896225f237907ca6807a9), [`e62c108`](https://github.com/mastra-ai/mastra/commit/e62c108409dfd6a6cac0a48ec39c5cc81d24fd52), [`bfbbb01`](https://github.com/mastra-ai/mastra/commit/bfbbb01bd845ba54cdc0c678c277d08a7cb847e4)]:
  - @mastra/core@1.48.0-alpha.4
  - @mastra/server@1.48.0-alpha.4
  - @mastra/hono@1.5.3-alpha.4

## 0.27.0-alpha.3

### Patch Changes

- Fixed MCP HTTP server URLs so `${VAR}` references resolve from the environment, the same way header values already do. A server configured with `"url": "${MCP_SERVER_URL}"` is now connected instead of being silently skipped as an invalid URL. ([#18579](https://github.com/mastra-ai/mastra/pull/18579))

- MCP stdio servers now resolve `${VAR}` references in their `env` values from the host environment, matching the existing behavior for HTTP server headers. You can reference secrets from the environment instead of hardcoding them in `mcp.json`: ([#18529](https://github.com/mastra-ai/mastra/pull/18529))

  ```json
  {
    "mcpServers": {
      "github": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
      }
    }
  }
  ```

- Updated dependencies [[`cdd5f93`](https://github.com/mastra-ai/mastra/commit/cdd5f939cefa67390629704dce92563ccbf492b2), [`1b8728a`](https://github.com/mastra-ai/mastra/commit/1b8728a57fd844205a452b0b4216d20ff60c784a), [`9feeaa0`](https://github.com/mastra-ai/mastra/commit/9feeaa0f9a1af07039e5b4f22b932b0cb18617e8), [`e05dade`](https://github.com/mastra-ai/mastra/commit/e05dade21c3e2551893ad939e6028cdafd84a1b2), [`213feb8`](https://github.com/mastra-ai/mastra/commit/213feb87bfdd1d8ec00ea660e218f9bcfcb34e7b)]:
  - @mastra/core@1.48.0-alpha.3
  - @mastra/schema-compat@1.3.2-alpha.0
  - @mastra/server@1.48.0-alpha.3
  - @mastra/mcp@1.12.0
  - @mastra/memory@1.21.3-alpha.0
  - @mastra/hono@1.5.3-alpha.3

## 0.27.0-alpha.2

### Patch Changes

- Updated dependencies [[`e420b3c`](https://github.com/mastra-ai/mastra/commit/e420b3c3ffc98bbc5b791897ea390bb47af99696)]:
  - @mastra/core@1.48.0-alpha.2
  - @mastra/server@1.48.0-alpha.2
  - @mastra/hono@1.5.3-alpha.2

## 0.27.0-alpha.1

### Minor Changes

- **Improved web settings data loading** ([#18518](https://github.com/mastra-ai/mastra/pull/18518))
  - Settings panels now avoid duplicate requests and refresh lists after saves or removals.
  - Provider keys, custom providers, model packs, observational memory, and the directory picker now stay in sync automatically.
  - Streaming chat behavior is unchanged.

### Patch Changes

- Updated dependencies [[`95857bc`](https://github.com/mastra-ai/mastra/commit/95857bcd6669da7193f503e803f0d72a2bd66be6), [`8e9c0fb`](https://github.com/mastra-ai/mastra/commit/8e9c0fb48fd58da2efcdff2cf1202ee41092c315)]:
  - @mastra/core@1.48.0-alpha.1
  - @mastra/server@1.48.0-alpha.1
  - @mastra/hono@1.5.3-alpha.1

## 0.26.1-alpha.0

### Patch Changes

- Set goal judge `maxSteps` to 1000 (matching the main agent) so the judge has ample budget for complex goals requiring heavy verification. ([#18544](https://github.com/mastra-ai/mastra/pull/18544))

- Updated dependencies [[`b9a2961`](https://github.com/mastra-ai/mastra/commit/b9a2961c1be81e3639c0879e58588c26dd0ae866), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`9566d27`](https://github.com/mastra-ai/mastra/commit/9566d27ead3d95bdbe5a69e5a082a68222829cf2)]:
  - @mastra/core@1.48.0-alpha.0
  - @mastra/server@1.48.0-alpha.0
  - @mastra/hono@1.5.3-alpha.0

## 0.26.0

### Minor Changes

- Added a live tokens/sec counter to the MastraCode terminal and web status lines. ([#18501](https://github.com/mastra-ai/mastra/pull/18501))

  The counter shows how fast the model is generating, measured over decode time only — the window from the first streamed token of a step to when that step finishes. This excludes time-to-first-token, tool execution, and scheduling gaps, so the number reflects real generation speed instead of reading artificially low. Reasoning tokens are included, and the rate is smoothed with an exponential moving average for a stable readout.

  The last reading stays visible while idle so you can read it after a turn finishes, and it clears when the next turn begins.

- Add a browser UI for MastraCode. ([#18364](https://github.com/mastra-ai/mastra/pull/18364))

  The web app boots the real MastraCode Harness, registers it on a Mastra
  instance, mounts the Harness HTTP routes (via `@mastra/server`) on a Hono
  server, and serves a React UI built with Vite. The UI drives a session over the
  `@mastra/client-js` harness resource (SSE event stream + JSON commands) and
  reaches feature parity with the terminal for the core interactive workflows:
  chat streaming, tool execution, tool approvals, interactive suspensions
  (`ask_user` / `submit_plan` / `request_access`), mode/model switching, thread
  lifecycle, task tracking, goals, notifications, steer/abort, follow-ups, a
  TUI-parity status line (message/reflection budgets and active-goal indicator),
  and project-scoped workspaces with a server-driven directory picker.

  A full Settings surface mirrors the terminal's configuration commands: model
  selection, behavior (`yolo`, thinking level, notifications, smart editing,
  per-category tool permissions), observational-memory models and thresholds,
  model packs, API keys, and custom providers. These are backed by
  `/api/web/config/*` routes that read and write the same global `settings.json`
  the terminal uses, so configuration stays in sync across the terminal and the
  browser.

  The web server shares its storage with the registered Harness, and projects
  resolve the same `resourceId` as the terminal, so the two share durable threads
  and observations for a given project. Thread lists are scoped by project path so
  worktrees that share a `resourceId` don't bleed each other's threads.

  Internally, harness startup is shared through a single base factory with small
  per-environment helpers, so the terminal app and the web server build the exact
  same harness without duplicating wiring. The published `mastracode` package
  remains terminal-only — the web UI lives in the repository for local
  development and is excluded from the published package.

  Includes a scenario test suite that drives the production stack
  (`MastraClient` → Hono → `@mastra/server` routes → Harness → AIMock) end to end.

### Patch Changes

- Fixed MastraCode queued follow-up E2E tests to wait for stable terminal output. ([#18507](https://github.com/mastra-ai/mastra/pull/18507))

- Reworked plan mode to use named plan files. The agent writes its plan to a markdown file under `.mastracode/plans/` and calls `submit_plan` with the `path` to that file, so multiple plans stay on disk for review. The host validates the submitted path is a `.md` file inside `.mastracode/plans/` before reading it, so the tool can't be pointed at arbitrary files. Plan mode can write any `.md` file inside `.mastracode/plans/` (enforced by a tool guard) but nothing else, submitted plan snapshots are persisted for history replay, revision diffs are computed from a real line-ending-normalized LCS diff and only shown when the change is small relative to the plan, "Request Changes" stops the run immediately with no trailing model output, and diffs only compare revisions of the same plan file. ([#18490](https://github.com/mastra-ai/mastra/pull/18490))

- Fixed thread auto-resume selecting the wrong thread in git worktrees by scoping startup selection to threads tagged with the current project path. When Mastra Code detects a matching project thread on a different resource after resourceId drift, it now prompts before cloning and resuming that thread under the current resource; accepting the prompt leaves the old thread untouched and loads the clone, while declining starts fresh and leaves the old resource untouched. ([#18333](https://github.com/mastra-ai/mastra/pull/18333))

- Switched internal imports to the canonical `@mastra/core/agent-controller` entrypoint, replacing the deprecated `@mastra/core/harness` path and `Harness` types. Updated the web client to call `getAgentController()` and use the new `AgentControllerEvent` type, renamed the `useHarnessSession` hook to `useAgentControllerSession`, and renamed the `handleHarnessEvent` ACP mapper to `handleAgentControllerEvent`. ([#18510](https://github.com/mastra-ai/mastra/pull/18510))

- Resolve all Harness models through gateways. The Harness now builds its available-models catalog, model auth status, mode agents, Observational Memory models, and subagents from the gateways you register, instead of the separate `resolveModel`, `customModelCatalogProvider`, and `modelAuthChecker` config hooks. Removed those three options from `HarnessConfig` (and the `ModelAuthChecker` type) — register a gateway via `gateways` instead. ([#18382](https://github.com/mastra-ai/mastra/pull/18382))

  `listAvailableModels()` and `getCurrentModelAuthStatus()` are now sourced entirely from gateways: model discovery comes from each gateway's `fetchProviders()` (a network call for gateways like models.dev and Netlify), and auth status is resolved through the same gateway chain the model router uses at run time (`resolveAuth()`, falling back to `getApiKey()`). There is no static provider-registry fallback — everything the model picker shows comes from a gateway.

  The gateway-chain operations shared by `ModelRouterLanguageModel` and the Harness (gateway merging, model→gateway selection, auth resolution, provider/model listing) are now centralized in a new `GatewayManager` class exported from `@mastra/core`. Both consumers delegate to it, eliminating duplicated logic. `defaultGateways` is still re-exported from the same paths for backward compatibility.

- Fixed OAuth logins (such as Anthropic and OpenAI sign-in) not being recognized for the selected model. The model status bar no longer shows a false "missing API key" error, and the `/api-keys` command and web settings panel now display a distinct "oauth" status for providers you are signed into instead of treating them as unset. ([#18503](https://github.com/mastra-ai/mastra/pull/18503))

- Added support for reading MCP server config from a project root `.mcp.json` (the file Claude Code uses). Projects that already keep their MCP servers there no longer need a duplicate under `.mastracode/`. The root file sits below `.mastracode/mcp.json` in priority, so project-specific config still wins. ([#18494](https://github.com/mastra-ai/mastra/pull/18494))

- MastraCode now passes a deterministic session `id` and `ownerId` to the Harness session. The session id is derived from the project resource ID and is stable across restarts for the same project directory. The owner id is derived from the machine hostname and project root path, tying the session to the local machine. ([#18372](https://github.com/mastra-ai/mastra/pull/18372))

- Expand `${VAR}`, `${VAR:-default}`, and bare `$VAR` references in MCP server HTTP headers. Header values such as `"x-api-key": "${MY_API_KEY}"` in `mcp.json` are now resolved from the environment when the config is loaded, instead of being sent verbatim. This matches how Claude Code reads `.mcp.json` and lets header-authenticated HTTP servers pull secrets from the environment. ([#18240](https://github.com/mastra-ai/mastra/pull/18240))

- Updated plan and explore modes to declare `availableTools` allowlists so tool visibility is gated at LLM-call time instead of workspace construction. Plan mode includes read-only tools plus plan-file editing and delivery tools; explore mode includes only read-only tools. Build mode remains unrestricted. Workspace creation no longer branches on mode for tool visibility — all modes now share the same workspace instance. ([#18463](https://github.com/mastra-ai/mastra/pull/18463))

- Improved plan mode UX: "Request changes" stops the agent via processor-based abort and lets you provide revision feedback via chat. Plan resubmissions show a diff of what changed. Plans save to title-derived filenames (e.g. `add-dark-mode.md`) for multi-plan support. Plan filename displayed in TUI header. ([#18323](https://github.com/mastra-ai/mastra/pull/18323))

- Add MastraCode browser tool availability scenarios ([#18498](https://github.com/mastra-ai/mastra/pull/18498))

- Updated dependencies [[`86623c1`](https://github.com/mastra-ai/mastra/commit/86623c1adf7d22de32cc916dda17f4155184db36), [`023766f`](https://github.com/mastra-ai/mastra/commit/023766f44d59b30a50f3a381e33eddde8ab56c00), [`0200e75`](https://github.com/mastra-ai/mastra/commit/0200e7552d02d4221cd6040bf4eddf189a97a156), [`7c9dd77`](https://github.com/mastra-ai/mastra/commit/7c9dd77bd18cb8dc72797e25f1a0fbdc71a11347), [`42d74d5`](https://github.com/mastra-ai/mastra/commit/42d74d5671f95aa6076576e32a9b7d11f13dd208), [`7f9ae70`](https://github.com/mastra-ai/mastra/commit/7f9ae70826b047e5a66218f9e92f20e54a2d791f), [`b4e97e6`](https://github.com/mastra-ai/mastra/commit/b4e97e676232a3a398ef32d3e78faa0c91c5fa1c), [`a0509c7`](https://github.com/mastra-ai/mastra/commit/a0509c731a08aa3ed626557c5338126362856f57), [`06e0d63`](https://github.com/mastra-ai/mastra/commit/06e0d63d42bc2a202e18bc091f3781f409f5e6fb), [`bf3fe49`](https://github.com/mastra-ai/mastra/commit/bf3fe49f9467dbbdb8f9eaf74e0f7971ffb19559), [`01caf93`](https://github.com/mastra-ai/mastra/commit/01caf93d71ae2c1e65f49735cafb531975187426), [`438a971`](https://github.com/mastra-ai/mastra/commit/438a9715c8b4398e5eaf8914a1f19dc8a85dc1de), [`9990965`](https://github.com/mastra-ai/mastra/commit/999096571635a83b42ef40841fd7028cfa630779), [`24ceaea`](https://github.com/mastra-ai/mastra/commit/24ceaea0bdd8609cabbab764380608ca6621a194), [`77518cc`](https://github.com/mastra-ai/mastra/commit/77518ccb5bb8cc684875081e64213dc85cffdbee), [`fbeda0c`](https://github.com/mastra-ai/mastra/commit/fbeda0c0f35def07e6837936dd3a003b2b7c5172), [`8a68844`](https://github.com/mastra-ai/mastra/commit/8a688443013816105a09f89c6afa34b5ff13e26d), [`bb2a13b`](https://github.com/mastra-ai/mastra/commit/bb2a13bb4b32e6bb807200fe7b18ae8fa4322118), [`24ceaea`](https://github.com/mastra-ai/mastra/commit/24ceaea0bdd8609cabbab764380608ca6621a194), [`a73cd1a`](https://github.com/mastra-ai/mastra/commit/a73cd1a62a5e4ca023dcc39ba150029f4f1f74c1), [`24ceaea`](https://github.com/mastra-ai/mastra/commit/24ceaea0bdd8609cabbab764380608ca6621a194), [`c0ffa3c`](https://github.com/mastra-ai/mastra/commit/c0ffa3c897ccd326de880df734740a7f0681a18f), [`462a769`](https://github.com/mastra-ai/mastra/commit/462a769da61850862ca1be3d74134d33078ee6a7), [`0504bf5`](https://github.com/mastra-ai/mastra/commit/0504bf5e8cffc571a4b343326178de371e6f859b), [`fbeda0c`](https://github.com/mastra-ai/mastra/commit/fbeda0c0f35def07e6837936dd3a003b2b7c5172), [`9e45902`](https://github.com/mastra-ai/mastra/commit/9e4590208e745055cecca202e2db0e5c65e17d3c), [`0b5cc47`](https://github.com/mastra-ai/mastra/commit/0b5cc4726dc18d9a685a27520db39ff1b36bb89a), [`87f38a3`](https://github.com/mastra-ai/mastra/commit/87f38a3de03e24731f2dd6f8ed6a60b6722b85a1), [`d5fa3cd`](https://github.com/mastra-ai/mastra/commit/d5fa3cda1788c3cb93a361a3c6ec47de6ba21e98), [`fe98ef2`](https://github.com/mastra-ai/mastra/commit/fe98ef2e66dbfcbd7d645c88c9ee1e67b458a136), [`e1f272d`](https://github.com/mastra-ai/mastra/commit/e1f272d2bf1963c0ccb060f34b103b0b780bbff0), [`6ccf67b`](https://github.com/mastra-ai/mastra/commit/6ccf67bf075753754927a57bc2e1734ba2c820c5), [`26f54af`](https://github.com/mastra-ai/mastra/commit/26f54afb5dbfbbb02d4d09bec4bd7c5029751767), [`793ea0f`](https://github.com/mastra-ai/mastra/commit/793ea0f52f831178837f21c83af6af93bf4ce638), [`825d8de`](https://github.com/mastra-ai/mastra/commit/825d8def9fa64c2bcc3d8dd6b49e09342c3ac5c7), [`507a5c4`](https://github.com/mastra-ai/mastra/commit/507a5c461bdc3136ad80744c0efbb55ce1f18f97), [`5afe423`](https://github.com/mastra-ai/mastra/commit/5afe423e4badf040f1b0d4525183a856fcb8146e), [`307573b`](https://github.com/mastra-ai/mastra/commit/307573b9ff3149b70c79540dbc86f1319b180f29), [`79b3626`](https://github.com/mastra-ai/mastra/commit/79b3626f8d647307eb07c8da14c9073c2699719d), [`c2c1d7b`](https://github.com/mastra-ai/mastra/commit/c2c1d7bb61d2602955f14ed3952f807c2d6eb576), [`86623c1`](https://github.com/mastra-ai/mastra/commit/86623c1adf7d22de32cc916dda17f4155184db36), [`1505c07`](https://github.com/mastra-ai/mastra/commit/1505c07603f6346bae12aa82f140e8b88ffea9ab), [`f328049`](https://github.com/mastra-ai/mastra/commit/f3280498c324afd2a8d36cd828f5b9f94a2dddc1), [`e545228`](https://github.com/mastra-ai/mastra/commit/e54522856934a5dc030b7b6385771e3548020d59), [`74f447a`](https://github.com/mastra-ai/mastra/commit/74f447a6fae171ac3a6ec2d9e61be171ca46d23c), [`3eb852e`](https://github.com/mastra-ai/mastra/commit/3eb852e5435bc908b800193498103dc724f455b0), [`ffa09e7`](https://github.com/mastra-ai/mastra/commit/ffa09e772a5c92270eabe2090fc42d45bd8ec4b7), [`8c9f1c0`](https://github.com/mastra-ai/mastra/commit/8c9f1c0361d89066f9bcd14a2f69e761b01766c8), [`461a7c5`](https://github.com/mastra-ai/mastra/commit/461a7c501449295287f4f0ee4b0b42344f39fcf8), [`4211472`](https://github.com/mastra-ai/mastra/commit/4211472a5a2bd319c60cd2e42d9109c3eef7ac1c), [`9e45902`](https://github.com/mastra-ai/mastra/commit/9e4590208e745055cecca202e2db0e5c65e17d3c), [`5c0df77`](https://github.com/mastra-ai/mastra/commit/5c0df776c40efa420f8c07a2f3ee66010296618e), [`e940f09`](https://github.com/mastra-ai/mastra/commit/e940f099ef5d18b403e6f2b4937e086a4da857b1)]:
  - @mastra/core@1.47.0
  - @mastra/server@1.47.0
  - @mastra/observability@1.15.2
  - @mastra/memory@1.21.2
  - @mastra/pg@1.14.2
  - @mastra/libsql@1.14.2
  - @mastra/github-signals@0.2.2
  - @mastra/schema-compat@1.3.1
  - @mastra/hono@1.5.2
  - @mastra/mcp@1.12.0

## 0.26.0-alpha.8

### Patch Changes

- Reworked plan mode to use named plan files. The agent writes its plan to a markdown file under `.mastracode/plans/` and calls `submit_plan` with the `path` to that file, so multiple plans stay on disk for review. The host validates the submitted path is a `.md` file inside `.mastracode/plans/` before reading it, so the tool can't be pointed at arbitrary files. Plan mode can write any `.md` file inside `.mastracode/plans/` (enforced by a tool guard) but nothing else, submitted plan snapshots are persisted for history replay, revision diffs are computed from a real line-ending-normalized LCS diff and only shown when the change is small relative to the plan, "Request Changes" stops the run immediately with no trailing model output, and diffs only compare revisions of the same plan file. ([#18490](https://github.com/mastra-ai/mastra/pull/18490))

- Updated dependencies [[`8a68844`](https://github.com/mastra-ai/mastra/commit/8a688443013816105a09f89c6afa34b5ff13e26d)]:
  - @mastra/core@1.47.0-alpha.7
  - @mastra/server@1.47.0-alpha.7
  - @mastra/hono@1.5.2-alpha.7

## 0.26.0-alpha.7

### Patch Changes

- Fixed MastraCode queued follow-up E2E tests to wait for stable terminal output. ([#18507](https://github.com/mastra-ai/mastra/pull/18507))

## 0.26.0-alpha.6

### Minor Changes

- Added a live tokens/sec counter to the MastraCode terminal and web status lines. ([#18501](https://github.com/mastra-ai/mastra/pull/18501))

  The counter shows how fast the model is generating, measured over decode time only — the window from the first streamed token of a step to when that step finishes. This excludes time-to-first-token, tool execution, and scheduling gaps, so the number reflects real generation speed instead of reading artificially low. Reasoning tokens are included, and the rate is smoothed with an exponential moving average for a stable readout.

  The last reading stays visible while idle so you can read it after a turn finishes, and it clears when the next turn begins.

### Patch Changes

- Switched internal imports to the canonical `@mastra/core/agent-controller` entrypoint, replacing the deprecated `@mastra/core/harness` path and `Harness` types. Updated the web client to call `getAgentController()` and use the new `AgentControllerEvent` type, renamed the `useHarnessSession` hook to `useAgentControllerSession`, and renamed the `handleHarnessEvent` ACP mapper to `handleAgentControllerEvent`. ([#18510](https://github.com/mastra-ai/mastra/pull/18510))

- Fixed OAuth logins (such as Anthropic and OpenAI sign-in) not being recognized for the selected model. The model status bar no longer shows a false "missing API key" error, and the `/api-keys` command and web settings panel now display a distinct "oauth" status for providers you are signed into instead of treating them as unset. ([#18503](https://github.com/mastra-ai/mastra/pull/18503))

- Added support for reading MCP server config from a project root `.mcp.json` (the file Claude Code uses). Projects that already keep their MCP servers there no longer need a duplicate under `.mastracode/`. The root file sits below `.mastracode/mcp.json` in priority, so project-specific config still wins. ([#18494](https://github.com/mastra-ai/mastra/pull/18494))

- Add MastraCode browser tool availability scenarios ([#18498](https://github.com/mastra-ai/mastra/pull/18498))

- Updated dependencies [[`0200e75`](https://github.com/mastra-ai/mastra/commit/0200e7552d02d4221cd6040bf4eddf189a97a156), [`42d74d5`](https://github.com/mastra-ai/mastra/commit/42d74d5671f95aa6076576e32a9b7d11f13dd208), [`b4e97e6`](https://github.com/mastra-ai/mastra/commit/b4e97e676232a3a398ef32d3e78faa0c91c5fa1c), [`06e0d63`](https://github.com/mastra-ai/mastra/commit/06e0d63d42bc2a202e18bc091f3781f409f5e6fb), [`438a971`](https://github.com/mastra-ai/mastra/commit/438a9715c8b4398e5eaf8914a1f19dc8a85dc1de), [`77518cc`](https://github.com/mastra-ai/mastra/commit/77518ccb5bb8cc684875081e64213dc85cffdbee), [`bb2a13b`](https://github.com/mastra-ai/mastra/commit/bb2a13bb4b32e6bb807200fe7b18ae8fa4322118), [`a73cd1a`](https://github.com/mastra-ai/mastra/commit/a73cd1a62a5e4ca023dcc39ba150029f4f1f74c1), [`0b5cc47`](https://github.com/mastra-ai/mastra/commit/0b5cc4726dc18d9a685a27520db39ff1b36bb89a), [`87f38a3`](https://github.com/mastra-ai/mastra/commit/87f38a3de03e24731f2dd6f8ed6a60b6722b85a1), [`d5fa3cd`](https://github.com/mastra-ai/mastra/commit/d5fa3cda1788c3cb93a361a3c6ec47de6ba21e98), [`fe98ef2`](https://github.com/mastra-ai/mastra/commit/fe98ef2e66dbfcbd7d645c88c9ee1e67b458a136), [`793ea0f`](https://github.com/mastra-ai/mastra/commit/793ea0f52f831178837f21c83af6af93bf4ce638), [`507a5c4`](https://github.com/mastra-ai/mastra/commit/507a5c461bdc3136ad80744c0efbb55ce1f18f97), [`79b3626`](https://github.com/mastra-ai/mastra/commit/79b3626f8d647307eb07c8da14c9073c2699719d)]:
  - @mastra/server@1.47.0-alpha.6
  - @mastra/core@1.47.0-alpha.6
  - @mastra/observability@1.15.2-alpha.1
  - @mastra/memory@1.21.2-alpha.1
  - @mastra/schema-compat@1.3.1-alpha.0
  - @mastra/hono@1.5.2-alpha.6
  - @mastra/mcp@1.12.0

## 0.26.0-alpha.5

### Minor Changes

- Add a browser UI for MastraCode. ([#18364](https://github.com/mastra-ai/mastra/pull/18364))

  The web app boots the real MastraCode Harness, registers it on a Mastra
  instance, mounts the Harness HTTP routes (via `@mastra/server`) on a Hono
  server, and serves a React UI built with Vite. The UI drives a session over the
  `@mastra/client-js` harness resource (SSE event stream + JSON commands) and
  reaches feature parity with the terminal for the core interactive workflows:
  chat streaming, tool execution, tool approvals, interactive suspensions
  (`ask_user` / `submit_plan` / `request_access`), mode/model switching, thread
  lifecycle, task tracking, goals, notifications, steer/abort, follow-ups, a
  TUI-parity status line (message/reflection budgets and active-goal indicator),
  and project-scoped workspaces with a server-driven directory picker.

  A full Settings surface mirrors the terminal's configuration commands: model
  selection, behavior (`yolo`, thinking level, notifications, smart editing,
  per-category tool permissions), observational-memory models and thresholds,
  model packs, API keys, and custom providers. These are backed by
  `/api/web/config/*` routes that read and write the same global `settings.json`
  the terminal uses, so configuration stays in sync across the terminal and the
  browser.

  The web server shares its storage with the registered Harness, and projects
  resolve the same `resourceId` as the terminal, so the two share durable threads
  and observations for a given project. Thread lists are scoped by project path so
  worktrees that share a `resourceId` don't bleed each other's threads.

  Internally, harness startup is shared through a single base factory with small
  per-environment helpers, so the terminal app and the web server build the exact
  same harness without duplicating wiring. The published `mastracode` package
  remains terminal-only — the web UI lives in the repository for local
  development and is excluded from the published package.

  Includes a scenario test suite that drives the production stack
  (`MastraClient` → Hono → `@mastra/server` routes → Harness → AIMock) end to end.

### Patch Changes

- Updated dependencies [[`023766f`](https://github.com/mastra-ai/mastra/commit/023766f44d59b30a50f3a381e33eddde8ab56c00), [`a0509c7`](https://github.com/mastra-ai/mastra/commit/a0509c731a08aa3ed626557c5338126362856f57), [`01caf93`](https://github.com/mastra-ai/mastra/commit/01caf93d71ae2c1e65f49735cafb531975187426), [`c2c1d7b`](https://github.com/mastra-ai/mastra/commit/c2c1d7bb61d2602955f14ed3952f807c2d6eb576), [`3eb852e`](https://github.com/mastra-ai/mastra/commit/3eb852e5435bc908b800193498103dc724f455b0)]:
  - @mastra/core@1.47.0-alpha.5
  - @mastra/server@1.47.0-alpha.5
  - @mastra/hono@1.5.2-alpha.5

## 0.25.1-alpha.4

### Patch Changes

- Updated dependencies [[`462a769`](https://github.com/mastra-ai/mastra/commit/462a769da61850862ca1be3d74134d33078ee6a7), [`f328049`](https://github.com/mastra-ai/mastra/commit/f3280498c324afd2a8d36cd828f5b9f94a2dddc1), [`e545228`](https://github.com/mastra-ai/mastra/commit/e54522856934a5dc030b7b6385771e3548020d59)]:
  - @mastra/core@1.47.0-alpha.4

## 0.25.1-alpha.3

### Patch Changes

- Updated plan and explore modes to declare `availableTools` allowlists so tool visibility is gated at LLM-call time instead of workspace construction. Plan mode includes read-only tools plus plan-file editing and delivery tools; explore mode includes only read-only tools. Build mode remains unrestricted. Workspace creation no longer branches on mode for tool visibility — all modes now share the same workspace instance. ([#18463](https://github.com/mastra-ai/mastra/pull/18463))

- Updated dependencies [[`bf3fe49`](https://github.com/mastra-ai/mastra/commit/bf3fe49f9467dbbdb8f9eaf74e0f7971ffb19559), [`24ceaea`](https://github.com/mastra-ai/mastra/commit/24ceaea0bdd8609cabbab764380608ca6621a194), [`24ceaea`](https://github.com/mastra-ai/mastra/commit/24ceaea0bdd8609cabbab764380608ca6621a194), [`24ceaea`](https://github.com/mastra-ai/mastra/commit/24ceaea0bdd8609cabbab764380608ca6621a194), [`e1f272d`](https://github.com/mastra-ai/mastra/commit/e1f272d2bf1963c0ccb060f34b103b0b780bbff0), [`6ccf67b`](https://github.com/mastra-ai/mastra/commit/6ccf67bf075753754927a57bc2e1734ba2c820c5), [`825d8de`](https://github.com/mastra-ai/mastra/commit/825d8def9fa64c2bcc3d8dd6b49e09342c3ac5c7), [`74f447a`](https://github.com/mastra-ai/mastra/commit/74f447a6fae171ac3a6ec2d9e61be171ca46d23c), [`ffa09e7`](https://github.com/mastra-ai/mastra/commit/ffa09e772a5c92270eabe2090fc42d45bd8ec4b7), [`461a7c5`](https://github.com/mastra-ai/mastra/commit/461a7c501449295287f4f0ee4b0b42344f39fcf8), [`4211472`](https://github.com/mastra-ai/mastra/commit/4211472a5a2bd319c60cd2e42d9109c3eef7ac1c), [`9e45902`](https://github.com/mastra-ai/mastra/commit/9e4590208e745055cecca202e2db0e5c65e17d3c), [`5c0df77`](https://github.com/mastra-ai/mastra/commit/5c0df776c40efa420f8c07a2f3ee66010296618e)]:
  - @mastra/core@1.47.0-alpha.3
  - @mastra/pg@1.14.2-alpha.1
  - @mastra/libsql@1.14.2-alpha.0
  - @mastra/observability@1.15.2-alpha.0

## 0.25.1-alpha.2

### Patch Changes

- Fixed thread auto-resume selecting the wrong thread in git worktrees by scoping startup selection to threads tagged with the current project path. When Mastra Code detects a matching project thread on a different resource after resourceId drift, it now prompts before cloning and resuming that thread under the current resource; accepting the prompt leaves the old thread untouched and loads the clone, while declining starts fresh and leaves the old resource untouched. ([#18333](https://github.com/mastra-ai/mastra/pull/18333))

- Resolve all Harness models through gateways. The Harness now builds its available-models catalog, model auth status, mode agents, Observational Memory models, and subagents from the gateways you register, instead of the separate `resolveModel`, `customModelCatalogProvider`, and `modelAuthChecker` config hooks. Removed those three options from `HarnessConfig` (and the `ModelAuthChecker` type) — register a gateway via `gateways` instead. ([#18382](https://github.com/mastra-ai/mastra/pull/18382))

  `listAvailableModels()` and `getCurrentModelAuthStatus()` are now sourced entirely from gateways: model discovery comes from each gateway's `fetchProviders()` (a network call for gateways like models.dev and Netlify), and auth status is resolved through the same gateway chain the model router uses at run time (`resolveAuth()`, falling back to `getApiKey()`). There is no static provider-registry fallback — everything the model picker shows comes from a gateway.

  The gateway-chain operations shared by `ModelRouterLanguageModel` and the Harness (gateway merging, model→gateway selection, auth resolution, provider/model listing) are now centralized in a new `GatewayManager` class exported from `@mastra/core`. Both consumers delegate to it, eliminating duplicated logic. `defaultGateways` is still re-exported from the same paths for backward compatibility.

- Improved plan mode UX: "Request changes" stops the agent via processor-based abort and lets you provide revision feedback via chat. Plan resubmissions show a diff of what changed. Plans save to title-derived filenames (e.g. `add-dark-mode.md`) for multi-plan support. Plan filename displayed in TUI header. ([#18323](https://github.com/mastra-ai/mastra/pull/18323))

- Updated dependencies [[`86623c1`](https://github.com/mastra-ai/mastra/commit/86623c1adf7d22de32cc916dda17f4155184db36), [`7c9dd77`](https://github.com/mastra-ai/mastra/commit/7c9dd77bd18cb8dc72797e25f1a0fbdc71a11347), [`9990965`](https://github.com/mastra-ai/mastra/commit/999096571635a83b42ef40841fd7028cfa630779), [`c0ffa3c`](https://github.com/mastra-ai/mastra/commit/c0ffa3c897ccd326de880df734740a7f0681a18f), [`0504bf5`](https://github.com/mastra-ai/mastra/commit/0504bf5e8cffc571a4b343326178de371e6f859b), [`26f54af`](https://github.com/mastra-ai/mastra/commit/26f54afb5dbfbbb02d4d09bec4bd7c5029751767), [`5afe423`](https://github.com/mastra-ai/mastra/commit/5afe423e4badf040f1b0d4525183a856fcb8146e), [`86623c1`](https://github.com/mastra-ai/mastra/commit/86623c1adf7d22de32cc916dda17f4155184db36), [`8c9f1c0`](https://github.com/mastra-ai/mastra/commit/8c9f1c0361d89066f9bcd14a2f69e761b01766c8)]:
  - @mastra/core@1.47.0-alpha.2
  - @mastra/pg@1.14.2-alpha.0

## 0.25.1-alpha.1

### Patch Changes

- MastraCode now passes a deterministic session `id` and `ownerId` to the Harness session. The session id is derived from the project resource ID and is stable across restarts for the same project directory. The owner id is derived from the machine hostname and project root path, tying the session to the local machine. ([#18372](https://github.com/mastra-ai/mastra/pull/18372))

- Expand `${VAR}`, `${VAR:-default}`, and bare `$VAR` references in MCP server HTTP headers. Header values such as `"x-api-key": "${MY_API_KEY}"` in `mcp.json` are now resolved from the environment when the config is loaded, instead of being sent verbatim. This matches how Claude Code reads `.mcp.json` and lets header-authenticated HTTP servers pull secrets from the environment. ([#18240](https://github.com/mastra-ai/mastra/pull/18240))

- Updated dependencies [[`7f9ae70`](https://github.com/mastra-ai/mastra/commit/7f9ae70826b047e5a66218f9e92f20e54a2d791f), [`1505c07`](https://github.com/mastra-ai/mastra/commit/1505c07603f6346bae12aa82f140e8b88ffea9ab), [`e940f09`](https://github.com/mastra-ai/mastra/commit/e940f099ef5d18b403e6f2b4937e086a4da857b1)]:
  - @mastra/core@1.46.1-alpha.1
  - @mastra/memory@1.21.2-alpha.0

## 0.25.1-alpha.0

### Patch Changes

- Updated dependencies [[`fbeda0c`](https://github.com/mastra-ai/mastra/commit/fbeda0c0f35def07e6837936dd3a003b2b7c5172), [`fbeda0c`](https://github.com/mastra-ai/mastra/commit/fbeda0c0f35def07e6837936dd3a003b2b7c5172), [`307573b`](https://github.com/mastra-ai/mastra/commit/307573b9ff3149b70c79540dbc86f1319b180f29)]:
  - @mastra/core@1.46.1-alpha.0
  - @mastra/github-signals@0.2.2-alpha.0

## 0.25.0

### Minor Changes

- Added ACP server mode for `mastracode`. ([#18231](https://github.com/mastra-ai/mastra/pull/18231))

  You can now connect ACP-compatible editors and clients to `mastracode` over stdio. This lets clients start sessions, send prompts, and receive streamed responses.

  **Example**

  ```bash
  mastracode --acp
  ```

- Added automatic OpenAI subscription support for Stagehand browser automation. When a user has an active OpenAI subscription (authenticated via /login), Stagehand now uses the subscription credentials for its AI operations (act/extract/observe) instead of requiring a separate OPENAI_API_KEY. ([#18233](https://github.com/mastra-ai/mastra/pull/18233))

### Patch Changes

- Removed the deprecated `Harness.getState()` and `Harness.setState()` compatibility wrappers, along with the unused private `updateState`. Harness state has lived on the session for a while; these were thin proxies marked `@deprecated`. ([#18200](https://github.com/mastra-ai/mastra/pull/18200))

  **Before**

  ```typescript
  const state = harness.getState();
  await harness.setState({ count: 1 });
  ```

  **After**

  ```typescript
  const state = harness.session.state.get();
  await harness.session.state.set({ count: 1 });
  ```

  This does not affect the tool-facing harness context, which continues to expose `state` / `getState` / `setState` / `updateState` alongside `session.state`.

  `mastracode` is updated to set browser settings via `session.state.set()`.

- Moved the observational-memory model accessors off the Harness onto `session.om`. Reading and switching the observer/reflector models and reading observation/reflection thresholds now live on the session, next to the state they read and write. ([#18200](https://github.com/mastra-ai/mastra/pull/18200))

  **Before**

  ```typescript
  const observer = harness.getObserverModelId();
  await harness.switchObserverModel({ modelId: 'openai/gpt-4o' });
  ```

  **After**

  ```typescript
  const observer = harness.session.om.observer.modelId();
  await harness.session.om.observer.switchModel({ modelId: 'openai/gpt-4o' });
  ```

  The accessors are grouped by role under `session.om.observer` and `session.om.reflector`, each exposing `modelId()`, `threshold()`, `resolvedModel()`, and `switchModel({ modelId })`.

  Removed `Harness.getObserverModelId`, `getReflectorModelId`, `getObservationThreshold`, `getReflectionThreshold`, `getResolvedObserverModel`, `getResolvedReflectorModel`, `switchObserverModel`, and `switchReflectorModel`.

  `mastracode` is updated to consume the new API: the `/om` command and status line now read and switch observer/reflector models via `session.om`.

- Moved the run-control surface off the Harness onto the `Session`. Sending messages and signals, steering, following up, aborting, responding to tool suspensions, and saving system reminders now live on the session that owns the run state they drive, instead of being delegated through the Harness. This is the final step of the single-session extraction series and a prerequisite for the upcoming multi-session (`createSession`) work: every per-session operation now lives on `Session`, while the Harness retains only genuinely shared machinery (agent, config builders, storage/lock gateway), which it injects into each session via the `SessionMachinery` provider. ([#18213](https://github.com/mastra-ai/mastra/pull/18213))

  **Before**

  ```typescript
  await harness.sendMessage({ content: 'hello' });
  harness.sendSignal({ content: 'steer the run' });
  harness.abort();
  await harness.respondToToolSuspension({ toolCallId, approved: true });
  ```

  **After**

  ```typescript
  const session = await harness.createSession();
  await session.sendMessage({ content: 'hello' });
  session.sendSignal({ content: 'steer the run' });
  session.abort();
  await session.respondToToolSuspension({ toolCallId, approved: true });
  ```

  Removed `Harness.sendMessage`, `Harness.sendSignal`, `Harness.sendNotificationSignal`, `Harness.steer`, `Harness.followUp`, `Harness.abort`, `Harness.respondToToolSuspension`, `Harness.saveSystemReminderMessage`, and `Harness.waitForCurrentThreadStreamIdle`. The `Session` reaches Harness-owned machinery through the injected `SessionMachinery` provider, so the heavy run loop is still constructed and owned by the Harness while being parameterized by the session it runs on.

  `mastracode` is updated to consume the new API: the TUI run loop, slash-command dispatch, goal lifecycle, prompt handlers, and headless entry points all drive run-control through the session returned by `harness.createSession()`.

- The Harness event bus now lives on the Session. Each `Session` owns its own listeners and emit pipeline (`session.subscribe()` / internal `session.emit()`), so events emitted on one session are delivered only to that session's subscribers — never to another session's. This is the isolation foundation for serving a single Harness to multiple concurrent sessions (e.g. one Harness backing many channel threads). ([#18213](https://github.com/mastra-ai/mastra/pull/18213))

  Breaking (Harness is under active development): `Harness.subscribe()` is removed. Subscribe on the session instead:

  ```diff
  - harness.subscribe(listener)
  + harness.session.subscribe(listener)
  ```

  Session subsystems (mode/model/om/permissions/subagents/state) no longer receive an injected `emit` callback — they emit directly to their session's bus. `mastracode` is updated to subscribe via `harness.session.subscribe()`.

- Replaced `Harness.switchModel()` with `harness.session.model.switch()`. Model switching now lives on the session, alongside the active mode/model state it already owns. ([#18197](https://github.com/mastra-ai/mastra/pull/18197))

  **Before**

  ```typescript
  await harness.switchModel({ modelId: 'openai/gpt-5' });
  ```

  **After**

  ```typescript
  await harness.session.model.switch({ modelId: 'openai/gpt-5' });
  ```

- Replaced `Harness.switchMode()` with `harness.session.mode.switch()`. Switching modes now lives on the session, alongside the active mode/model state it already owns. ([#18197](https://github.com/mastra-ai/mastra/pull/18197))

  **Before**

  ```typescript
  await harness.switchMode({ modeId: 'build' });
  ```

  **After**

  ```typescript
  await harness.session.mode.switch({ modeId: 'build' });
  ```

  `mastracode` is updated to consume the new API: the TUI and headless callers now invoke `harness.session.mode.switch()` instead of the removed `harness.switchMode()`.

- Restored task list progress and history rendering behavior in Mastra Code. ([#18248](https://github.com/mastra-ai/mastra/pull/18248))

- Made the Harness a pure factory + shared-resource owner and removed its singleton session. The Harness no longer holds a `#session` field or exposes a `harness.session` getter; instead, callers create fully isolated sessions via `harness.createSession()`. Each session owns its own mode, model, state, thread, run-control, event bus, and stream engine, so a single Harness can now serve many concurrent sessions (e.g. one per user/thread in a server or channel adapter) without cross-session state or event leakage. ([#18213](https://github.com/mastra-ai/mastra/pull/18213))

  `harness.createSession({ resourceId? })` constructs and wires a new `Session`, replays the current workspace status onto it, and selects or creates its thread before returning. Harness methods that previously read the singleton session are now parameterized by an explicit `session` argument (`setResourceId`, `getKnownResourceIds`, `getCurrentModelAuthStatus`, `loadOMProgress`, `getObservationalMemoryRecord`, `destroy`). `harness.init()` is now idempotent, so repeated calls reuse the same initialization instead of rebuilding internal state.

  **Before**

  ```typescript
  const harness = new Harness(config);
  await harness.init();
  const session = harness.session; // singleton
  await session.sendMessage({ content: 'hello' });
  ```

  **After**

  ```typescript
  const harness = new Harness(config);
  await harness.init();
  const session = await harness.createSession({ resourceId });
  await session.sendMessage({ content: 'hello' });

  // A second, fully isolated session from the same Harness:
  const other = await harness.createSession({ resourceId: otherUser });
  ```

  Removed `harness.session`, `harness.getSession()`, the singleton `#session` field, and the deprecated `harness.subscribe`/`harness.emit`/`harness.memory` delegators.

  `mastracode` is updated to consume the new API: composition roots call `createSession()` once at startup and store the result on `state.session`, and all per-session operations flow through that session object.

- Added a public ACP export so workflows can import the ACP agent with `import { MastraCodeAcpAgent } from 'mastracode/acp'`. ([#18367](https://github.com/mastra-ai/mastra/pull/18367))

- MastraCode now automatically retries transient ECONNRESET model stream failures with exponential backoff. Dropped provider sockets recover without manual intervention using a global policy of 2 retries with delays of 1000ms, 2000ms, and 4000ms (capped at 30000ms), applied to all model calls independent of model-pack settings. ([#18370](https://github.com/mastra-ai/mastra/pull/18370))

- Exported isBadRequestError matcher for detecting transient HTTP 400 errors that can be retried ([#18384](https://github.com/mastra-ai/mastra/pull/18384))

- Migrate TUI thread operations to the session-scoped `session.thread.*` APIs following the core thread lifecycle migration. ([#18213](https://github.com/mastra-ai/mastra/pull/18213))

- Added automatic retry (once) for transient OpenAI Bad Request (400) errors that occur during service degradation ([#18384](https://github.com/mastra-ai/mastra/pull/18384))

- Resolve notification stream options from the target resource's session (falling back to the active session's model, then the mode default) so a woken GitHub-signal notification always has a model to run with. ([#18213](https://github.com/mastra-ai/mastra/pull/18213))

- Moved the tool-permission rule accessors off the Harness onto `session.permissions`. Reading and writing the persisted per-category / per-tool approval policies now lives on the session, next to the state it reads and writes. ([#18200](https://github.com/mastra-ai/mastra/pull/18200))

  **Before**

  ```typescript
  const rules = harness.getPermissionRules();
  harness.setPermissionForCategory({ category: 'execute', policy: 'ask' });
  harness.setPermissionForTool({ toolName: 'dangerous_tool', policy: 'deny' });
  ```

  **After**

  ```typescript
  const rules = harness.session.permissions.getRules();
  await harness.session.permissions.setForCategory({ category: 'execute', policy: 'ask' });
  await harness.session.permissions.setForTool({ toolName: 'dangerous_tool', policy: 'deny' });
  ```

  Removed `Harness.getPermissionRules`, `Harness.setPermissionForCategory`, and `Harness.setPermissionForTool`. The setters now return a promise that resolves once the change is persisted to session state, so callers that read the rules back can await the write. Tool-category resolution stays on the harness as `harness.getToolCategory()` since it reads harness config rather than session state.

  `mastracode` is updated to consume the new API: the `/permissions` command reads and sets policies via `session.permissions`.

- Replaced `Harness.getModelName()` and `Harness.getFullModelId()` with session accessors. The full model id is read via the existing `harness.session.model.get()`, and the short display name moves to a new `harness.session.model.displayName()`. ([#18200](https://github.com/mastra-ai/mastra/pull/18200))

  **Before**

  ```typescript
  const name = harness.getModelName();
  const fullId = harness.getFullModelId();
  ```

  **After**

  ```typescript
  const name = harness.session.model.displayName();
  const fullId = harness.session.model.get();
  ```

  `mastracode` is updated to consume the new API: the TUI status line and message renderer now read the model id via `harness.session.model.get()`.

- Fix Stagehand AI ops (`observe`, `act`, `extract`) failing with `Bad Request` (HTTP 400) when the user is signed in to OpenAI Codex OAuth. ([#18399](https://github.com/mastra-ai/mastra/pull/18399))

  Stagehand drives its browser actions through AI SDK's non-streaming `generateText`, but Codex's `/responses` backend only accepts streamed requests and replies with Server-Sent Events. The previous integration routed Stagehand traffic to Codex by rewriting the request URL inside a custom `fetch`, but did not translate between the streaming and non-streaming shapes — so every Stagehand AI call was rejected by Codex.

  MastraCode now configures Stagehand with proper AI SDK provider options (`baseURL`, `headers`, `middleware`) and a dedicated `buildCodexStagehandFetch` that:
  - Injects (and refreshes) the Codex OAuth bearer per call
  - Forces `stream: true` on the outgoing request body
  - Aggregates the SSE response into the non-streaming JSON shape `@ai-sdk/openai`'s Responses parser expects

  The shared OAuth-bearer-refresh logic is extracted into a `getCodexBearer` helper used by both the main agent fetch and the Stagehand fetch.

  `observe`, `act`, and `extract` now work end-to-end against Codex OAuth using a Codex-compatible OpenAI model, with no `OPENAI_API_KEY` required.

- Fixed ACP server mode so sessions can start, receive prompts, and handle tool approvals after the Harness session changes. ([#18367](https://github.com/mastra-ai/mastra/pull/18367))

- Fixed Mastra Code steering display so messages wait for runtime acceptance, blocked inputs are shown as blocked instead of chat, abort cleanup removes pending steering without duplicating output, and plan approvals continue correctly in same-mode and cross-mode flows. ([#18183](https://github.com/mastra-ai/mastra/pull/18183))

- Fixed thread loading in worktrees to only show threads explicitly tagged for the current worktree path, preventing threads from other worktrees or the main repo from being incorrectly loaded on startup ([#18332](https://github.com/mastra-ai/mastra/pull/18332))

- Moved the subagent model accessors off the Harness onto `session.subagents.model`. Reading and setting the global or per-`agentType` subagent model now lives on the session, next to the state it reads and writes, and is grouped under `session.subagents` to leave room for future subagent settings. ([#18200](https://github.com/mastra-ai/mastra/pull/18200))

  **Before**

  ```typescript
  const modelId = harness.getSubagentModelId({ agentType: 'explore' });
  await harness.setSubagentModelId({ modelId: 'anthropic/claude-sonnet-4', agentType: 'explore' });
  ```

  **After**

  ```typescript
  const modelId = harness.session.subagents.model.get({ agentType: 'explore' });
  await harness.session.subagents.model.set({ modelId: 'anthropic/claude-sonnet-4', agentType: 'explore' });
  ```

  `get()` prefers the per-`agentType` value, then the global subagent model, returning `null` when neither is set. `set()` persists to thread settings and emits a `subagent_model_changed` event. Removed `Harness.getSubagentModelId` and `Harness.setSubagentModelId`.

  `mastracode` is updated to consume the new API: the `/subagents` command, model-pack activation, and startup model restoration read and set subagent models via `session.subagents.model`.

- Updated dependencies [[`5bd72d2`](https://github.com/mastra-ai/mastra/commit/5bd72d255f45b5ea8ab342643bd463814a980a24), [`1cc9ee1`](https://github.com/mastra-ai/mastra/commit/1cc9ee1ba51db53020a735626d33017a60b4b5b3), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`b4a43c7`](https://github.com/mastra-ai/mastra/commit/b4a43c705c961d24c9888690ae84451ca1630197), [`65f255a`](https://github.com/mastra-ai/mastra/commit/65f255a38667beb6ceeadabfa9eb5059bfec8298), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`30ebaf0`](https://github.com/mastra-ai/mastra/commit/30ebaf07bed5f4d30f2f257836c15d1bf7e40aae), [`5704634`](https://github.com/mastra-ai/mastra/commit/5704634b22133167dea337a942a34f57aaa3fa14), [`5c4e9a4`](https://github.com/mastra-ai/mastra/commit/5c4e9a4cfb2216bb3ea7f8988ad3727f3b92bb3a), [`4a88c6e`](https://github.com/mastra-ai/mastra/commit/4a88c6e2bdce316f8d7551b4ec3449b0b06fc71c), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`6a1428a`](https://github.com/mastra-ai/mastra/commit/6a1428a23133fc070fc6c1caa08d28f3ba4fe5ff), [`87a17ef`](https://github.com/mastra-ai/mastra/commit/87a17efbd725aca6639febdc5e69e2abb3048689), [`e11ff30`](https://github.com/mastra-ai/mastra/commit/e11ff301408bf1731dca2fb7fbfcd8c819500a35), [`7794d71`](https://github.com/mastra-ai/mastra/commit/7794d71872c68733a30e028dfb7b1705daf6c5d2), [`9d2c946`](https://github.com/mastra-ai/mastra/commit/9d2c946d0859e90ae4bcec5beeb1da7398d2ad1e), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`7b29f33`](https://github.com/mastra-ai/mastra/commit/7b29f332a357a83e555f29e718e5f2fab9979943), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`b13925b`](https://github.com/mastra-ai/mastra/commit/b13925bfa91aa8700f56fa54a9ce707ee7e4ba62), [`f1ec385`](https://github.com/mastra-ai/mastra/commit/f1ec385386f62b1a0847ec5353ae2bb169d1c3d9), [`e14986f`](https://github.com/mastra-ai/mastra/commit/e14986f6e5478d6384d04ff9a7f9a79a46a8b529), [`24912b1`](https://github.com/mastra-ai/mastra/commit/24912b1f855d29ec36af4ef4bde1f7417e20cdf5), [`bf94ec6`](https://github.com/mastra-ai/mastra/commit/bf94ec68192d9f16e46ef7e5ac36370aeeddf35d), [`a29f371`](https://github.com/mastra-ai/mastra/commit/a29f371aef629ac8562661524a497127e93b5131), [`7686216`](https://github.com/mastra-ai/mastra/commit/7686216f37e74568feddec17cef3c3d24e10e60a), [`6075e17`](https://github.com/mastra-ai/mastra/commit/6075e173c4f11b889df5a592e0a708d6307220eb), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`073f910`](https://github.com/mastra-ai/mastra/commit/073f910481e7d94b95ba3830f96531774ae95d33), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`974f614`](https://github.com/mastra-ai/mastra/commit/974f614e083bd68278536f94453f7b320b86a3c7), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`3818814`](https://github.com/mastra-ai/mastra/commit/38188149ce454c4403fe9fcbdf73b735c68d36be), [`25d1854`](https://github.com/mastra-ai/mastra/commit/25d18545337e615f3fc573ddbfc0c413157bd148), [`975c59a`](https://github.com/mastra-ai/mastra/commit/975c59ae363ee275fc55062392e1ffd2cbccbd53), [`1f97ce5`](https://github.com/mastra-ai/mastra/commit/1f97ce5695463bebb4eaacf501da6fb403e20885), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`7f51548`](https://github.com/mastra-ai/mastra/commit/7f515481213780be7047cef00640b9d35f3d545c), [`64f58c0`](https://github.com/mastra-ai/mastra/commit/64f58c04e78b40137497d47f781e897e416f22a5), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`42b13ad`](https://github.com/mastra-ai/mastra/commit/42b13ad9d92a9d72ea6e96a8c87bf83797167eac), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`d95f394`](https://github.com/mastra-ai/mastra/commit/d95f394fd24c8411886930d727679c4d5252aa26), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`b89fbd1`](https://github.com/mastra-ai/mastra/commit/b89fbd15bfdceeee469651c81133f70cc22a6fb9), [`cff28df`](https://github.com/mastra-ai/mastra/commit/cff28df33476e41c9538cf9dba7fc8013d69ebb1), [`8e25a78`](https://github.com/mastra-ai/mastra/commit/8e25a78e0597575f0b0729bae8c5e190c84869b5), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`f3f0c9d`](https://github.com/mastra-ai/mastra/commit/f3f0c9d7c878db5a13177871ce3523a14f14b311), [`a5b22d3`](https://github.com/mastra-ai/mastra/commit/a5b22d314d62a68d801886a8d3d0eb6c089473db), [`31be1cf`](https://github.com/mastra-ai/mastra/commit/31be1cf5f2a7b5eef12f6123a40653b4d8115c16), [`31be1cf`](https://github.com/mastra-ai/mastra/commit/31be1cf5f2a7b5eef12f6123a40653b4d8115c16), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858)]:
  - @mastra/core@1.46.0
  - @mastra/pg@1.14.1
  - @mastra/github-signals@0.2.1
  - @mastra/libsql@1.14.1
  - @mastra/memory@1.21.1
  - @mastra/observability@1.15.1
  - @mastra/mcp@1.12.0

## 0.25.0-alpha.5

### Patch Changes

- Exported isBadRequestError matcher for detecting transient HTTP 400 errors that can be retried ([#18384](https://github.com/mastra-ai/mastra/pull/18384))

- Added automatic retry (once) for transient OpenAI Bad Request (400) errors that occur during service degradation ([#18384](https://github.com/mastra-ai/mastra/pull/18384))

- Fix Stagehand AI ops (`observe`, `act`, `extract`) failing with `Bad Request` (HTTP 400) when the user is signed in to OpenAI Codex OAuth. ([#18399](https://github.com/mastra-ai/mastra/pull/18399))

  Stagehand drives its browser actions through AI SDK's non-streaming `generateText`, but Codex's `/responses` backend only accepts streamed requests and replies with Server-Sent Events. The previous integration routed Stagehand traffic to Codex by rewriting the request URL inside a custom `fetch`, but did not translate between the streaming and non-streaming shapes — so every Stagehand AI call was rejected by Codex.

  MastraCode now configures Stagehand with proper AI SDK provider options (`baseURL`, `headers`, `middleware`) and a dedicated `buildCodexStagehandFetch` that:
  - Injects (and refreshes) the Codex OAuth bearer per call
  - Forces `stream: true` on the outgoing request body
  - Aggregates the SSE response into the non-streaming JSON shape `@ai-sdk/openai`'s Responses parser expects

  The shared OAuth-bearer-refresh logic is extracted into a `getCodexBearer` helper used by both the main agent fetch and the Stagehand fetch.

  `observe`, `act`, and `extract` now work end-to-end against Codex OAuth using a Codex-compatible OpenAI model, with no `OPENAI_API_KEY` required.

- Updated dependencies [[`3818814`](https://github.com/mastra-ai/mastra/commit/38188149ce454c4403fe9fcbdf73b735c68d36be)]:
  - @mastra/core@1.46.0-alpha.5

## 0.25.0-alpha.4

### Patch Changes

- Restored task list progress and history rendering behavior in Mastra Code. ([#18248](https://github.com/mastra-ai/mastra/pull/18248))

- MastraCode now automatically retries transient ECONNRESET model stream failures with exponential backoff. Dropped provider sockets recover without manual intervention using a global policy of 2 retries with delays of 1000ms, 2000ms, and 4000ms (capped at 30000ms), applied to all model calls independent of model-pack settings. ([#18370](https://github.com/mastra-ai/mastra/pull/18370))

- Updated dependencies [[`5c4e9a4`](https://github.com/mastra-ai/mastra/commit/5c4e9a4cfb2216bb3ea7f8988ad3727f3b92bb3a), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`7b29f33`](https://github.com/mastra-ai/mastra/commit/7b29f332a357a83e555f29e718e5f2fab9979943), [`24912b1`](https://github.com/mastra-ai/mastra/commit/24912b1f855d29ec36af4ef4bde1f7417e20cdf5), [`7686216`](https://github.com/mastra-ai/mastra/commit/7686216f37e74568feddec17cef3c3d24e10e60a), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`975c59a`](https://github.com/mastra-ai/mastra/commit/975c59ae363ee275fc55062392e1ffd2cbccbd53), [`d95f394`](https://github.com/mastra-ai/mastra/commit/d95f394fd24c8411886930d727679c4d5252aa26), [`f3f0c9d`](https://github.com/mastra-ai/mastra/commit/f3f0c9d7c878db5a13177871ce3523a14f14b311)]:
  - @mastra/core@1.46.0-alpha.4
  - @mastra/libsql@1.14.1-alpha.1
  - @mastra/pg@1.14.1-alpha.1

## 0.25.0-alpha.3

### Patch Changes

- Added a public ACP export so workflows can import the ACP agent with `import { MastraCodeAcpAgent } from 'mastracode/acp'`. ([#18367](https://github.com/mastra-ai/mastra/pull/18367))

- Fixed ACP server mode so sessions can start, receive prompts, and handle tool approvals after the Harness session changes. ([#18367](https://github.com/mastra-ai/mastra/pull/18367))

- Updated dependencies [[`b4a43c7`](https://github.com/mastra-ai/mastra/commit/b4a43c705c961d24c9888690ae84451ca1630197), [`65f255a`](https://github.com/mastra-ai/mastra/commit/65f255a38667beb6ceeadabfa9eb5059bfec8298), [`4a88c6e`](https://github.com/mastra-ai/mastra/commit/4a88c6e2bdce316f8d7551b4ec3449b0b06fc71c), [`87a17ef`](https://github.com/mastra-ai/mastra/commit/87a17efbd725aca6639febdc5e69e2abb3048689), [`e11ff30`](https://github.com/mastra-ai/mastra/commit/e11ff301408bf1731dca2fb7fbfcd8c819500a35), [`9d2c946`](https://github.com/mastra-ai/mastra/commit/9d2c946d0859e90ae4bcec5beeb1da7398d2ad1e), [`f1ec385`](https://github.com/mastra-ai/mastra/commit/f1ec385386f62b1a0847ec5353ae2bb169d1c3d9), [`e14986f`](https://github.com/mastra-ai/mastra/commit/e14986f6e5478d6384d04ff9a7f9a79a46a8b529), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`974f614`](https://github.com/mastra-ai/mastra/commit/974f614e083bd68278536f94453f7b320b86a3c7), [`25d1854`](https://github.com/mastra-ai/mastra/commit/25d18545337e615f3fc573ddbfc0c413157bd148), [`42b13ad`](https://github.com/mastra-ai/mastra/commit/42b13ad9d92a9d72ea6e96a8c87bf83797167eac), [`cff28df`](https://github.com/mastra-ai/mastra/commit/cff28df33476e41c9538cf9dba7fc8013d69ebb1), [`31be1cf`](https://github.com/mastra-ai/mastra/commit/31be1cf5f2a7b5eef12f6123a40653b4d8115c16), [`31be1cf`](https://github.com/mastra-ai/mastra/commit/31be1cf5f2a7b5eef12f6123a40653b4d8115c16)]:
  - @mastra/pg@1.14.1-alpha.0
  - @mastra/core@1.46.0-alpha.3
  - @mastra/libsql@1.14.1-alpha.0
  - @mastra/observability@1.15.1-alpha.0
  - @mastra/memory@1.21.1-alpha.1

## 0.25.0-alpha.2

### Minor Changes

- Added ACP server mode for `mastracode`. ([#18231](https://github.com/mastra-ai/mastra/pull/18231))

  You can now connect ACP-compatible editors and clients to `mastracode` over stdio. This lets clients start sessions, send prompts, and receive streamed responses.

  **Example**

  ```bash
  mastracode --acp
  ```

### Patch Changes

- Fixed Mastra Code steering display so messages wait for runtime acceptance, blocked inputs are shown as blocked instead of chat, abort cleanup removes pending steering without duplicating output, and plan approvals continue correctly in same-mode and cross-mode flows. ([#18183](https://github.com/mastra-ai/mastra/pull/18183))

- Fixed thread loading in worktrees to only show threads explicitly tagged for the current worktree path, preventing threads from other worktrees or the main repo from being incorrectly loaded on startup ([#18332](https://github.com/mastra-ai/mastra/pull/18332))

- Updated dependencies [[`6a1428a`](https://github.com/mastra-ai/mastra/commit/6a1428a23133fc070fc6c1caa08d28f3ba4fe5ff), [`7f51548`](https://github.com/mastra-ai/mastra/commit/7f515481213780be7047cef00640b9d35f3d545c)]:
  - @mastra/core@1.46.0-alpha.2

## 0.25.0-alpha.1

### Patch Changes

- Updated dependencies [[`7794d71`](https://github.com/mastra-ai/mastra/commit/7794d71872c68733a30e028dfb7b1705daf6c5d2)]:
  - @mastra/core@1.46.0-alpha.1

## 0.25.0-alpha.0

### Minor Changes

- Added automatic OpenAI subscription support for Stagehand browser automation. When a user has an active OpenAI subscription (authenticated via /login), Stagehand now uses the subscription credentials for its AI operations (act/extract/observe) instead of requiring a separate OPENAI_API_KEY. ([#18233](https://github.com/mastra-ai/mastra/pull/18233))

### Patch Changes

- Removed the deprecated `Harness.getState()` and `Harness.setState()` compatibility wrappers, along with the unused private `updateState`. Harness state has lived on the session for a while; these were thin proxies marked `@deprecated`. ([#18200](https://github.com/mastra-ai/mastra/pull/18200))

  **Before**

  ```typescript
  const state = harness.getState();
  await harness.setState({ count: 1 });
  ```

  **After**

  ```typescript
  const state = harness.session.state.get();
  await harness.session.state.set({ count: 1 });
  ```

  This does not affect the tool-facing harness context, which continues to expose `state` / `getState` / `setState` / `updateState` alongside `session.state`.

  `mastracode` is updated to set browser settings via `session.state.set()`.

- Moved the observational-memory model accessors off the Harness onto `session.om`. Reading and switching the observer/reflector models and reading observation/reflection thresholds now live on the session, next to the state they read and write. ([#18200](https://github.com/mastra-ai/mastra/pull/18200))

  **Before**

  ```typescript
  const observer = harness.getObserverModelId();
  await harness.switchObserverModel({ modelId: 'openai/gpt-4o' });
  ```

  **After**

  ```typescript
  const observer = harness.session.om.observer.modelId();
  await harness.session.om.observer.switchModel({ modelId: 'openai/gpt-4o' });
  ```

  The accessors are grouped by role under `session.om.observer` and `session.om.reflector`, each exposing `modelId()`, `threshold()`, `resolvedModel()`, and `switchModel({ modelId })`.

  Removed `Harness.getObserverModelId`, `getReflectorModelId`, `getObservationThreshold`, `getReflectionThreshold`, `getResolvedObserverModel`, `getResolvedReflectorModel`, `switchObserverModel`, and `switchReflectorModel`.

  `mastracode` is updated to consume the new API: the `/om` command and status line now read and switch observer/reflector models via `session.om`.

- Moved the run-control surface off the Harness onto the `Session`. Sending messages and signals, steering, following up, aborting, responding to tool suspensions, and saving system reminders now live on the session that owns the run state they drive, instead of being delegated through the Harness. This is the final step of the single-session extraction series and a prerequisite for the upcoming multi-session (`createSession`) work: every per-session operation now lives on `Session`, while the Harness retains only genuinely shared machinery (agent, config builders, storage/lock gateway), which it injects into each session via the `SessionMachinery` provider. ([#18213](https://github.com/mastra-ai/mastra/pull/18213))

  **Before**

  ```typescript
  await harness.sendMessage({ content: 'hello' });
  harness.sendSignal({ content: 'steer the run' });
  harness.abort();
  await harness.respondToToolSuspension({ toolCallId, approved: true });
  ```

  **After**

  ```typescript
  const session = await harness.createSession();
  await session.sendMessage({ content: 'hello' });
  session.sendSignal({ content: 'steer the run' });
  session.abort();
  await session.respondToToolSuspension({ toolCallId, approved: true });
  ```

  Removed `Harness.sendMessage`, `Harness.sendSignal`, `Harness.sendNotificationSignal`, `Harness.steer`, `Harness.followUp`, `Harness.abort`, `Harness.respondToToolSuspension`, `Harness.saveSystemReminderMessage`, and `Harness.waitForCurrentThreadStreamIdle`. The `Session` reaches Harness-owned machinery through the injected `SessionMachinery` provider, so the heavy run loop is still constructed and owned by the Harness while being parameterized by the session it runs on.

  `mastracode` is updated to consume the new API: the TUI run loop, slash-command dispatch, goal lifecycle, prompt handlers, and headless entry points all drive run-control through the session returned by `harness.createSession()`.

- The Harness event bus now lives on the Session. Each `Session` owns its own listeners and emit pipeline (`session.subscribe()` / internal `session.emit()`), so events emitted on one session are delivered only to that session's subscribers — never to another session's. This is the isolation foundation for serving a single Harness to multiple concurrent sessions (e.g. one Harness backing many channel threads). ([#18213](https://github.com/mastra-ai/mastra/pull/18213))

  Breaking (Harness is under active development): `Harness.subscribe()` is removed. Subscribe on the session instead:

  ```diff
  - harness.subscribe(listener)
  + harness.session.subscribe(listener)
  ```

  Session subsystems (mode/model/om/permissions/subagents/state) no longer receive an injected `emit` callback — they emit directly to their session's bus. `mastracode` is updated to subscribe via `harness.session.subscribe()`.

- Replaced `Harness.switchModel()` with `harness.session.model.switch()`. Model switching now lives on the session, alongside the active mode/model state it already owns. ([#18197](https://github.com/mastra-ai/mastra/pull/18197))

  **Before**

  ```typescript
  await harness.switchModel({ modelId: 'openai/gpt-5' });
  ```

  **After**

  ```typescript
  await harness.session.model.switch({ modelId: 'openai/gpt-5' });
  ```

- Replaced `Harness.switchMode()` with `harness.session.mode.switch()`. Switching modes now lives on the session, alongside the active mode/model state it already owns. ([#18197](https://github.com/mastra-ai/mastra/pull/18197))

  **Before**

  ```typescript
  await harness.switchMode({ modeId: 'build' });
  ```

  **After**

  ```typescript
  await harness.session.mode.switch({ modeId: 'build' });
  ```

  `mastracode` is updated to consume the new API: the TUI and headless callers now invoke `harness.session.mode.switch()` instead of the removed `harness.switchMode()`.

- Made the Harness a pure factory + shared-resource owner and removed its singleton session. The Harness no longer holds a `#session` field or exposes a `harness.session` getter; instead, callers create fully isolated sessions via `harness.createSession()`. Each session owns its own mode, model, state, thread, run-control, event bus, and stream engine, so a single Harness can now serve many concurrent sessions (e.g. one per user/thread in a server or channel adapter) without cross-session state or event leakage. ([#18213](https://github.com/mastra-ai/mastra/pull/18213))

  `harness.createSession({ resourceId? })` constructs and wires a new `Session`, replays the current workspace status onto it, and selects or creates its thread before returning. Harness methods that previously read the singleton session are now parameterized by an explicit `session` argument (`setResourceId`, `getKnownResourceIds`, `getCurrentModelAuthStatus`, `loadOMProgress`, `getObservationalMemoryRecord`, `destroy`). `harness.init()` is now idempotent, so repeated calls reuse the same initialization instead of rebuilding internal state.

  **Before**

  ```typescript
  const harness = new Harness(config);
  await harness.init();
  const session = harness.session; // singleton
  await session.sendMessage({ content: 'hello' });
  ```

  **After**

  ```typescript
  const harness = new Harness(config);
  await harness.init();
  const session = await harness.createSession({ resourceId });
  await session.sendMessage({ content: 'hello' });

  // A second, fully isolated session from the same Harness:
  const other = await harness.createSession({ resourceId: otherUser });
  ```

  Removed `harness.session`, `harness.getSession()`, the singleton `#session` field, and the deprecated `harness.subscribe`/`harness.emit`/`harness.memory` delegators.

  `mastracode` is updated to consume the new API: composition roots call `createSession()` once at startup and store the result on `state.session`, and all per-session operations flow through that session object.

- Migrate TUI thread operations to the session-scoped `session.thread.*` APIs following the core thread lifecycle migration. ([#18213](https://github.com/mastra-ai/mastra/pull/18213))

- Resolve notification stream options from the target resource's session (falling back to the active session's model, then the mode default) so a woken GitHub-signal notification always has a model to run with. ([#18213](https://github.com/mastra-ai/mastra/pull/18213))

- Moved the tool-permission rule accessors off the Harness onto `session.permissions`. Reading and writing the persisted per-category / per-tool approval policies now lives on the session, next to the state it reads and writes. ([#18200](https://github.com/mastra-ai/mastra/pull/18200))

  **Before**

  ```typescript
  const rules = harness.getPermissionRules();
  harness.setPermissionForCategory({ category: 'execute', policy: 'ask' });
  harness.setPermissionForTool({ toolName: 'dangerous_tool', policy: 'deny' });
  ```

  **After**

  ```typescript
  const rules = harness.session.permissions.getRules();
  await harness.session.permissions.setForCategory({ category: 'execute', policy: 'ask' });
  await harness.session.permissions.setForTool({ toolName: 'dangerous_tool', policy: 'deny' });
  ```

  Removed `Harness.getPermissionRules`, `Harness.setPermissionForCategory`, and `Harness.setPermissionForTool`. The setters now return a promise that resolves once the change is persisted to session state, so callers that read the rules back can await the write. Tool-category resolution stays on the harness as `harness.getToolCategory()` since it reads harness config rather than session state.

  `mastracode` is updated to consume the new API: the `/permissions` command reads and sets policies via `session.permissions`.

- Replaced `Harness.getModelName()` and `Harness.getFullModelId()` with session accessors. The full model id is read via the existing `harness.session.model.get()`, and the short display name moves to a new `harness.session.model.displayName()`. ([#18200](https://github.com/mastra-ai/mastra/pull/18200))

  **Before**

  ```typescript
  const name = harness.getModelName();
  const fullId = harness.getFullModelId();
  ```

  **After**

  ```typescript
  const name = harness.session.model.displayName();
  const fullId = harness.session.model.get();
  ```

  `mastracode` is updated to consume the new API: the TUI status line and message renderer now read the model id via `harness.session.model.get()`.

- Moved the subagent model accessors off the Harness onto `session.subagents.model`. Reading and setting the global or per-`agentType` subagent model now lives on the session, next to the state it reads and writes, and is grouped under `session.subagents` to leave room for future subagent settings. ([#18200](https://github.com/mastra-ai/mastra/pull/18200))

  **Before**

  ```typescript
  const modelId = harness.getSubagentModelId({ agentType: 'explore' });
  await harness.setSubagentModelId({ modelId: 'anthropic/claude-sonnet-4', agentType: 'explore' });
  ```

  **After**

  ```typescript
  const modelId = harness.session.subagents.model.get({ agentType: 'explore' });
  await harness.session.subagents.model.set({ modelId: 'anthropic/claude-sonnet-4', agentType: 'explore' });
  ```

  `get()` prefers the per-`agentType` value, then the global subagent model, returning `null` when neither is set. `set()` persists to thread settings and emits a `subagent_model_changed` event. Removed `Harness.getSubagentModelId` and `Harness.setSubagentModelId`.

  `mastracode` is updated to consume the new API: the `/subagents` command, model-pack activation, and startup model restoration read and set subagent models via `session.subagents.model`.

- Updated dependencies [[`5bd72d2`](https://github.com/mastra-ai/mastra/commit/5bd72d255f45b5ea8ab342643bd463814a980a24), [`1cc9ee1`](https://github.com/mastra-ai/mastra/commit/1cc9ee1ba51db53020a735626d33017a60b4b5b3), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`30ebaf0`](https://github.com/mastra-ai/mastra/commit/30ebaf07bed5f4d30f2f257836c15d1bf7e40aae), [`5704634`](https://github.com/mastra-ai/mastra/commit/5704634b22133167dea337a942a34f57aaa3fa14), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`b13925b`](https://github.com/mastra-ai/mastra/commit/b13925bfa91aa8700f56fa54a9ce707ee7e4ba62), [`bf94ec6`](https://github.com/mastra-ai/mastra/commit/bf94ec68192d9f16e46ef7e5ac36370aeeddf35d), [`a29f371`](https://github.com/mastra-ai/mastra/commit/a29f371aef629ac8562661524a497127e93b5131), [`6075e17`](https://github.com/mastra-ai/mastra/commit/6075e173c4f11b889df5a592e0a708d6307220eb), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`073f910`](https://github.com/mastra-ai/mastra/commit/073f910481e7d94b95ba3830f96531774ae95d33), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`1f97ce5`](https://github.com/mastra-ai/mastra/commit/1f97ce5695463bebb4eaacf501da6fb403e20885), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`64f58c0`](https://github.com/mastra-ai/mastra/commit/64f58c04e78b40137497d47f781e897e416f22a5), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`b89fbd1`](https://github.com/mastra-ai/mastra/commit/b89fbd15bfdceeee469651c81133f70cc22a6fb9), [`8e25a78`](https://github.com/mastra-ai/mastra/commit/8e25a78e0597575f0b0729bae8c5e190c84869b5), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`a5b22d3`](https://github.com/mastra-ai/mastra/commit/a5b22d314d62a68d801886a8d3d0eb6c089473db), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858)]:
  - @mastra/core@1.46.0-alpha.0
  - @mastra/github-signals@0.2.1-alpha.0
  - @mastra/memory@1.21.1-alpha.0
  - @mastra/mcp@1.12.0-alpha.0

## 0.24.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Improved Mastra Code responsiveness in large threads by speeding up chat rendering and keeping the initial thread render window bounded. ([#18181](https://github.com/mastra-ai/mastra/pull/18181))

- Fixed plan mode not calling submit_plan tool by removing conflicting subagent-style output instructions from mode definition ([#18157](https://github.com/mastra-ai/mastra/pull/18157))

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0
  - @mastra/agent-browser@0.4.0
  - @mastra/stagehand@0.3.0
  - @mastra/tavily@1.1.0
  - @mastra/observability@1.15.0
  - @mastra/fastembed@1.2.0
  - @mastra/mcp@1.11.0
  - @mastra/memory@1.21.0
  - @mastra/schema-compat@1.3.0
  - @mastra/github-signals@0.2.0
  - @mastra/duckdb@1.5.0
  - @mastra/libsql@1.14.0
  - @mastra/pg@1.14.0

## 0.24.0-alpha.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Improved Mastra Code responsiveness in large threads by speeding up chat rendering and keeping the initial thread render window bounded. ([#18181](https://github.com/mastra-ai/mastra/pull/18181))

- Fixed plan mode not calling submit_plan tool by removing conflicting subagent-style output instructions from mode definition ([#18157](https://github.com/mastra-ai/mastra/pull/18157))

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0-alpha.0
  - @mastra/agent-browser@0.4.0-alpha.0
  - @mastra/stagehand@0.3.0-alpha.0
  - @mastra/tavily@1.1.0-alpha.0
  - @mastra/observability@1.15.0-alpha.0
  - @mastra/fastembed@1.2.0-alpha.0
  - @mastra/mcp@1.11.0-alpha.0
  - @mastra/memory@1.21.0-alpha.0
  - @mastra/schema-compat@1.3.0-alpha.0
  - @mastra/github-signals@0.2.0-alpha.0
  - @mastra/duckdb@1.5.0-alpha.0
  - @mastra/libsql@1.14.0-alpha.0
  - @mastra/pg@1.14.0-alpha.0

## 0.23.1

### Patch Changes

- Removed the unused harness v1 TUI development script. ([#18131](https://github.com/mastra-ai/mastra/pull/18131))

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Made the native Agent goal mechanism robust, restoring behavior that regressed when goal handling moved into core. ([#18016](https://github.com/mastra-ai/mastra/pull/18016))
  - **Tool-capable judges.** Scorer judge configs accept optional `tools`, and the default goal scorer can use them to verify the agent's work against reality instead of grading prose alone. MastraCode wires its read-only workspace tools (`view`, `search_content`, `find_files`, `file_stat`, `lsp_inspect`) into `goal.tools`.
  - **Judge memory restored.** Scorer judge configs accept optional `memory`; goal scoring uses the original MastraCode per-goal judge thread shape and prompt format so repeated evaluations retain prior facts, feedback, and user checkpoints through judge memory.
  - **Tri-state waiting.** The default goal scorer emits `done`/`continue`/`waiting`; a `waiting` decision (only when the goal text explicitly asks to stop for the user) stops the auto-loop but keeps the objective `active` so the next agent turn is still judged — no `/goal resume` needed.
  - **Budget-exhaustion pause.** Reaching `maxRuns` without completing now parks the objective as `paused` with a clear reason, resumable by raising `maxRuns` and reactivating, instead of silently leaving it `active`.
  - **Judge-failure pause (no infinite loop).** Any failure while evaluating the goal — including judge-model/tools resolution, not just the scorer run — pauses the objective and stops the loop, surfacing the cause, rather than re-running the model against a broken judge every turn.
  - **Structured-output retry.** `tryGenerateWithJsonFallback` now retries with `jsonPromptInjection` when the judge resolves without a parseable object (not only on a thrown error), matching the streaming path.
  - **Signal-based feedback.** Goal judge feedback is now injected as a `goal-judge` system-reminder signal instead of an assistant-authored "Completion Check Results" transcript message, so reloads and subsequent model context match the original MastraCode goal loop. Continuation, waiting, paused, and done decisions all persist structured evaluation metadata for replay.
  - **TUI activity/replay fixes.** Goal evaluation chunks close the current assistant message before rendering the judge UI, stream judge activity with useful tool targets, stream partial judge reason text while scoring, replay persisted judge results as judge display components instead of raw Goal reminder text, and correctly persist Esc/Ctrl+C pauses while the judge is running.

  The goal evaluation chunk now carries `pausedReason`, `judgeFailed`, `waitingForUser`, `pending` (emitted before scoring starts so consumers can show a loading indicator), and judge `activity` entries including streamed `reason` updates.

- Move the Harness display state onto `session.displayState` ([#18136](https://github.com/mastra-ai/mastra/pull/18136))

  The canonical display state a UI renders — `isRunning`, active tools, tool-input
  buffers, pending approval/suspensions, active subagents, current message,
  queued follow-ups, modified files, tasks, OM progress, and token usage — now
  lives on the Session as `session.displayState`, alongside the reducer that keeps
  it in sync with every Harness event.

  `SessionDisplayState` owns:
  - `get()` — a read-only snapshot to render from (replaces `harness.getDisplayState()`)
  - `apply(event)` — the centralized state machine that folds each event into the snapshot
  - `resetThread()` — reset thread-scoped fields on thread switch/create
  - `restoreTasks(tasks)` — restore replayed task history without emitting an event
  - `clearPendingSuspensions()` / `deletePendingSuspension(toolCallId)` — display mirror upkeep on abort/resume

  Display state is inherently per-conversation, so in a shared (multi-user) host
  it can't hang off the Harness — `harness.getDisplayState()` has no single answer
  when one host serves many sessions. It reads from `harness.session.displayState`
  instead.

  The Harness stays the **event-bus owner**: `emit()` folds the event into
  `session.displayState` and then dispatches to listeners (including the
  `display_state_changed` fan-out). The reducer needs a few read-only host facts it
  doesn't own — the live token-usage tally, the subagent display-name lookup
  (Harness config), and the active thread id — which are injected into the Session
  at construction.

  Removed from the Harness public API (read through `harness.session.displayState.*`):
  - `getDisplayState()` → `session.displayState.get()`
  - `restoreDisplayTasks(tasks)` → `session.displayState.restoreTasks(tasks)`

  `restoreTasks` is now a pure session-state mutation (it no longer emits
  `display_state_changed`); the UI re-renders explicitly after a replay.

- Introduce the Harness `Session`: the Harness now exposes `harness.session`, a class that owns the per-conversation runtime state that previously lived flattened on the Harness instance. The Harness remains the shared host (storage, the thread lock, the agent registry, the event bus); the Session owns the state scoped to a single user's conversation. ([#18107](https://github.com/mastra-ai/mastra/pull/18107))

  `harness.session` owns:
  - **`session.identity`** — the session's `resourceId` / `defaultResourceId` (the stable "who").
  - **`session.thread`** — the active thread binding (`getId` / `set` / `clear` / `isSet` / `requireId`) plus the thread data domain scoped to the session: `list`, `getById`, `listMessages`, `listActiveMessages`, `firstUserMessage(s)`, and thread settings (`getSetting` / `setSetting` / `deleteSetting`). It reaches shared-host storage through an injected gateway rather than calling back into Harness orchestration.
  - **`session.mode`** / **`session.model`** — the currently-selected mode and model (source of truth), the mode-switch sequence, and per-mode model memory. The Harness still owns the mode _definitions_ (`config.modes`).
  - **`session.run`** — transient per-run identity (run id, trace id, operation counter) and abort control (controller, `isRunning`, `requestAbort`, …). Never persisted.
  - **`session.stream`** — the live agent-thread subscription handle and its dedup key. Adds `session.getCurrentRunId()` and `session.abortRun()`, which compose the subscription.
  - **`session.suspensions`** — the parked-tool resume map (`toolCallId → { runId, toolName }`) for tools paused via the native suspension primitive (`ask_user` / `request_access` / `submit_plan`).
  - **`session.followUps`** — the queue of messages to send after the active run finishes.
  - **`session.approval`** — the interactive tool-approval gate; `session.respondToToolApproval({ decision, requestContext })` applies the user's approve / decline / always-allow choice and releases the run.
  - session-scoped permission grants and the live token-usage counter (the Harness still persists usage to thread metadata, since usage is thread-scoped).

  **Removed from the Harness public API** — read these through `harness.session.*` instead:
  - `getSessionGrants()`, `getTokenUsage()` → `session.getGrants()` / `session.getTokenUsage()`
  - `getCurrentModelId()`, `hasModelSelected()` → `session.model.get()` / `session.model.hasSelection()`
  - `getCurrentRunId()`, `getCurrentTraceId()`, `isRunning()` → `session.getCurrentRunId()` / `session.run.getTraceId()` / `session.run.isRunning()`
  - `getCurrentThreadId()`, `getThreads()`, `listThreads()`, `listMessages()`, `listMessagesForThread()`, `getFirstUserMessage(s)ForThread(s)()`, `getThreadSetting()`, `setThreadSetting()` → `session.thread.*`
  - `getResourceId()`, `getDefaultResourceId()` → `session.identity.*`
  - `getFollowUpCount()` → `session.followUps.count()`
  - `respondToToolApproval()` → `session.respondToToolApproval()`
  - `getCurrentModeId()` → `session.mode.get()`
  - `getCurrentMode()` → `session.mode.resolve()` (resolves the selected mode id against the host's `config.modes` catalog, injected into the Session)
  - `hasPendingSuspensions()` → `session.suspensions.hasPending()`
  - `isCurrentThreadStreamActive()` → `session.stream.isActive()`

  `Harness.abort()` and `setResourceId()` remain on the Harness with unchanged behavior — they orchestrate Harness-host state (the display-state mirror, the agent-stream subscription, thread teardown) before delegating the relevant reads/writes to the session.

  `session.mode` exposes two complementary accessors: `get()` returns the selected mode **id** (a `string`, mirroring `session.model.get()`), while `resolve()` returns the full `HarnessMode` definition by looking the id up in the injected mode catalog.

  The legacy `HarnessCompat` shim (v1-session/legacy-thread merge) has been removed; its thread-list merge now lives in the Session's thread-data store, so `session.thread.list()` returns the merged result directly.

  `session.abortRun()` now also releases a parked tool-approval gate: a run awaiting `session.approval.arm()` is not actively streaming, so aborting resolves the gate as a decline (rejecting the gated tool) instead of leaving the await hung. Mirrors how abort already drops parked tool suspensions.

- Improved MastraCode Harness state access. ([#18133](https://github.com/mastra-ai/mastra/pull/18133))

  MastraCode now reads and writes Harness state through `harness.session.state` while keeping fallback support for older request-context mocks during the transition.

- Updated dependencies [[`339c57c`](https://github.com/mastra-ai/mastra/commit/339c57c5b2c6dbe75a125e138228e0556528976f), [`1dd4117`](https://github.com/mastra-ai/mastra/commit/1dd4117dcbd8e031ede9f0489436bfbc6f0315b8), [`2b11d1f`](https://github.com/mastra-ai/mastra/commit/2b11d1f6ac7024c5dd2b2dd12a48a956ac9d63bd), [`7d6ff70`](https://github.com/mastra-ai/mastra/commit/7d6ff708727297a0526ca0e26e93eeb5bbaaa187), [`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d), [`b7dff0a`](https://github.com/mastra-ai/mastra/commit/b7dff0a3d1022eb6868f48dc40a2b1febd5c277f), [`b91d921`](https://github.com/mastra-ai/mastra/commit/b91d9213a4998eb343dccd0ff780c42ba22bdfa1), [`02087e1`](https://github.com/mastra-ai/mastra/commit/02087e1fbc54aa07f3071f7a200df1bf5be601a8), [`49af8df`](https://github.com/mastra-ai/mastra/commit/49af8df589c4ff71a5015a4553b377b32704b691), [`30ce559`](https://github.com/mastra-ai/mastra/commit/30ce55902ecf819b8ab8697398dd68b108228063), [`c241b92`](https://github.com/mastra-ai/mastra/commit/c241b929dc8c8d6a7b7219c99ed13ac1f3124a77), [`7d6ff70`](https://github.com/mastra-ai/mastra/commit/7d6ff708727297a0526ca0e26e93eeb5bbaaa187), [`ab975d4`](https://github.com/mastra-ai/mastra/commit/ab975d4dd9488752f05bda7afa03166d207e3e2a), [`9d6aa1b`](https://github.com/mastra-ai/mastra/commit/9d6aa1bae407e2afa6a089abc2a6accbbcb287b8)]:
  - @mastra/core@1.44.0
  - @mastra/observability@1.14.4
  - @mastra/agent-browser@0.3.4
  - @mastra/duckdb@1.4.3
  - @mastra/fastembed@1.1.3
  - @mastra/github-signals@0.1.4
  - @mastra/libsql@1.13.3
  - @mastra/mcp@1.10.1
  - @mastra/memory@1.20.6
  - @mastra/pg@1.13.3
  - @mastra/schema-compat@1.2.14
  - @mastra/stagehand@0.2.7
  - @mastra/tavily@1.0.5

## 0.23.1-alpha.2

### Patch Changes

- Removed the unused harness v1 TUI development script. ([#18131](https://github.com/mastra-ai/mastra/pull/18131))

- Move the Harness display state onto `session.displayState` ([#18136](https://github.com/mastra-ai/mastra/pull/18136))

  The canonical display state a UI renders — `isRunning`, active tools, tool-input
  buffers, pending approval/suspensions, active subagents, current message,
  queued follow-ups, modified files, tasks, OM progress, and token usage — now
  lives on the Session as `session.displayState`, alongside the reducer that keeps
  it in sync with every Harness event.

  `SessionDisplayState` owns:
  - `get()` — a read-only snapshot to render from (replaces `harness.getDisplayState()`)
  - `apply(event)` — the centralized state machine that folds each event into the snapshot
  - `resetThread()` — reset thread-scoped fields on thread switch/create
  - `restoreTasks(tasks)` — restore replayed task history without emitting an event
  - `clearPendingSuspensions()` / `deletePendingSuspension(toolCallId)` — display mirror upkeep on abort/resume

  Display state is inherently per-conversation, so in a shared (multi-user) host
  it can't hang off the Harness — `harness.getDisplayState()` has no single answer
  when one host serves many sessions. It reads from `harness.session.displayState`
  instead.

  The Harness stays the **event-bus owner**: `emit()` folds the event into
  `session.displayState` and then dispatches to listeners (including the
  `display_state_changed` fan-out). The reducer needs a few read-only host facts it
  doesn't own — the live token-usage tally, the subagent display-name lookup
  (Harness config), and the active thread id — which are injected into the Session
  at construction.

  Removed from the Harness public API (read through `harness.session.displayState.*`):
  - `getDisplayState()` → `session.displayState.get()`
  - `restoreDisplayTasks(tasks)` → `session.displayState.restoreTasks(tasks)`

  `restoreTasks` is now a pure session-state mutation (it no longer emits
  `display_state_changed`); the UI re-renders explicitly after a replay.

- Introduce the Harness `Session`: the Harness now exposes `harness.session`, a class that owns the per-conversation runtime state that previously lived flattened on the Harness instance. The Harness remains the shared host (storage, the thread lock, the agent registry, the event bus); the Session owns the state scoped to a single user's conversation. ([#18107](https://github.com/mastra-ai/mastra/pull/18107))

  `harness.session` owns:
  - **`session.identity`** — the session's `resourceId` / `defaultResourceId` (the stable "who").
  - **`session.thread`** — the active thread binding (`getId` / `set` / `clear` / `isSet` / `requireId`) plus the thread data domain scoped to the session: `list`, `getById`, `listMessages`, `listActiveMessages`, `firstUserMessage(s)`, and thread settings (`getSetting` / `setSetting` / `deleteSetting`). It reaches shared-host storage through an injected gateway rather than calling back into Harness orchestration.
  - **`session.mode`** / **`session.model`** — the currently-selected mode and model (source of truth), the mode-switch sequence, and per-mode model memory. The Harness still owns the mode _definitions_ (`config.modes`).
  - **`session.run`** — transient per-run identity (run id, trace id, operation counter) and abort control (controller, `isRunning`, `requestAbort`, …). Never persisted.
  - **`session.stream`** — the live agent-thread subscription handle and its dedup key. Adds `session.getCurrentRunId()` and `session.abortRun()`, which compose the subscription.
  - **`session.suspensions`** — the parked-tool resume map (`toolCallId → { runId, toolName }`) for tools paused via the native suspension primitive (`ask_user` / `request_access` / `submit_plan`).
  - **`session.followUps`** — the queue of messages to send after the active run finishes.
  - **`session.approval`** — the interactive tool-approval gate; `session.respondToToolApproval({ decision, requestContext })` applies the user's approve / decline / always-allow choice and releases the run.
  - session-scoped permission grants and the live token-usage counter (the Harness still persists usage to thread metadata, since usage is thread-scoped).

  **Removed from the Harness public API** — read these through `harness.session.*` instead:
  - `getSessionGrants()`, `getTokenUsage()` → `session.getGrants()` / `session.getTokenUsage()`
  - `getCurrentModelId()`, `hasModelSelected()` → `session.model.get()` / `session.model.hasSelection()`
  - `getCurrentRunId()`, `getCurrentTraceId()`, `isRunning()` → `session.getCurrentRunId()` / `session.run.getTraceId()` / `session.run.isRunning()`
  - `getCurrentThreadId()`, `getThreads()`, `listThreads()`, `listMessages()`, `listMessagesForThread()`, `getFirstUserMessage(s)ForThread(s)()`, `getThreadSetting()`, `setThreadSetting()` → `session.thread.*`
  - `getResourceId()`, `getDefaultResourceId()` → `session.identity.*`
  - `getFollowUpCount()` → `session.followUps.count()`
  - `respondToToolApproval()` → `session.respondToToolApproval()`
  - `getCurrentModeId()` → `session.mode.get()`
  - `getCurrentMode()` → `session.mode.resolve()` (resolves the selected mode id against the host's `config.modes` catalog, injected into the Session)
  - `hasPendingSuspensions()` → `session.suspensions.hasPending()`
  - `isCurrentThreadStreamActive()` → `session.stream.isActive()`

  `Harness.abort()` and `setResourceId()` remain on the Harness with unchanged behavior — they orchestrate Harness-host state (the display-state mirror, the agent-stream subscription, thread teardown) before delegating the relevant reads/writes to the session.

  `session.mode` exposes two complementary accessors: `get()` returns the selected mode **id** (a `string`, mirroring `session.model.get()`), while `resolve()` returns the full `HarnessMode` definition by looking the id up in the injected mode catalog.

  The legacy `HarnessCompat` shim (v1-session/legacy-thread merge) has been removed; its thread-list merge now lives in the Session's thread-data store, so `session.thread.list()` returns the merged result directly.

  `session.abortRun()` now also releases a parked tool-approval gate: a run awaiting `session.approval.arm()` is not actively streaming, so aborting resolves the gate as a decline (rejecting the gated tool) instead of leaving the await hung. Mirrors how abort already drops parked tool suspensions.

- Improved MastraCode Harness state access. ([#18133](https://github.com/mastra-ai/mastra/pull/18133))

  MastraCode now reads and writes Harness state through `harness.session.state` while keeping fallback support for older request-context mocks during the transition.

- Updated dependencies [[`339c57c`](https://github.com/mastra-ai/mastra/commit/339c57c5b2c6dbe75a125e138228e0556528976f), [`1dd4117`](https://github.com/mastra-ai/mastra/commit/1dd4117dcbd8e031ede9f0489436bfbc6f0315b8), [`2b11d1f`](https://github.com/mastra-ai/mastra/commit/2b11d1f6ac7024c5dd2b2dd12a48a956ac9d63bd), [`7d6ff70`](https://github.com/mastra-ai/mastra/commit/7d6ff708727297a0526ca0e26e93eeb5bbaaa187), [`49af8df`](https://github.com/mastra-ai/mastra/commit/49af8df589c4ff71a5015a4553b377b32704b691), [`30ce559`](https://github.com/mastra-ai/mastra/commit/30ce55902ecf819b8ab8697398dd68b108228063), [`c241b92`](https://github.com/mastra-ai/mastra/commit/c241b929dc8c8d6a7b7219c99ed13ac1f3124a77), [`7d6ff70`](https://github.com/mastra-ai/mastra/commit/7d6ff708727297a0526ca0e26e93eeb5bbaaa187)]:
  - @mastra/core@1.44.0-alpha.2
  - @mastra/observability@1.14.4-alpha.1

## 0.23.1-alpha.1

### Patch Changes

- Made the native Agent goal mechanism robust, restoring behavior that regressed when goal handling moved into core. ([#18016](https://github.com/mastra-ai/mastra/pull/18016))
  - **Tool-capable judges.** Scorer judge configs accept optional `tools`, and the default goal scorer can use them to verify the agent's work against reality instead of grading prose alone. MastraCode wires its read-only workspace tools (`view`, `search_content`, `find_files`, `file_stat`, `lsp_inspect`) into `goal.tools`.
  - **Judge memory restored.** Scorer judge configs accept optional `memory`; goal scoring uses the original MastraCode per-goal judge thread shape and prompt format so repeated evaluations retain prior facts, feedback, and user checkpoints through judge memory.
  - **Tri-state waiting.** The default goal scorer emits `done`/`continue`/`waiting`; a `waiting` decision (only when the goal text explicitly asks to stop for the user) stops the auto-loop but keeps the objective `active` so the next agent turn is still judged — no `/goal resume` needed.
  - **Budget-exhaustion pause.** Reaching `maxRuns` without completing now parks the objective as `paused` with a clear reason, resumable by raising `maxRuns` and reactivating, instead of silently leaving it `active`.
  - **Judge-failure pause (no infinite loop).** Any failure while evaluating the goal — including judge-model/tools resolution, not just the scorer run — pauses the objective and stops the loop, surfacing the cause, rather than re-running the model against a broken judge every turn.
  - **Structured-output retry.** `tryGenerateWithJsonFallback` now retries with `jsonPromptInjection` when the judge resolves without a parseable object (not only on a thrown error), matching the streaming path.
  - **Signal-based feedback.** Goal judge feedback is now injected as a `goal-judge` system-reminder signal instead of an assistant-authored "Completion Check Results" transcript message, so reloads and subsequent model context match the original MastraCode goal loop. Continuation, waiting, paused, and done decisions all persist structured evaluation metadata for replay.
  - **TUI activity/replay fixes.** Goal evaluation chunks close the current assistant message before rendering the judge UI, stream judge activity with useful tool targets, stream partial judge reason text while scoring, replay persisted judge results as judge display components instead of raw Goal reminder text, and correctly persist Esc/Ctrl+C pauses while the judge is running.

  The goal evaluation chunk now carries `pausedReason`, `judgeFailed`, `waitingForUser`, `pending` (emitted before scoring starts so consumers can show a loading indicator), and judge `activity` entries including streamed `reason` updates.

- Updated dependencies [[`b7dff0a`](https://github.com/mastra-ai/mastra/commit/b7dff0a3d1022eb6868f48dc40a2b1febd5c277f), [`b91d921`](https://github.com/mastra-ai/mastra/commit/b91d9213a4998eb343dccd0ff780c42ba22bdfa1), [`02087e1`](https://github.com/mastra-ai/mastra/commit/02087e1fbc54aa07f3071f7a200df1bf5be601a8), [`ab975d4`](https://github.com/mastra-ai/mastra/commit/ab975d4dd9488752f05bda7afa03166d207e3e2a)]:
  - @mastra/core@1.44.0-alpha.1
  - @mastra/github-signals@0.1.4-alpha.1

## 0.23.1-alpha.0

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d)]:
  - @mastra/agent-browser@0.3.4-alpha.0
  - @mastra/core@1.43.1-alpha.0
  - @mastra/duckdb@1.4.3-alpha.0
  - @mastra/fastembed@1.1.3-alpha.0
  - @mastra/github-signals@0.1.4-alpha.0
  - @mastra/libsql@1.13.3-alpha.0
  - @mastra/mcp@1.10.1-alpha.0
  - @mastra/memory@1.20.6-alpha.0
  - @mastra/observability@1.14.4-alpha.0
  - @mastra/pg@1.13.3-alpha.0
  - @mastra/schema-compat@1.2.14-alpha.0
  - @mastra/stagehand@0.2.7-alpha.0
  - @mastra/tavily@1.0.5-alpha.0

## 0.23.0

### Minor Changes

- Reimplement `/goal` on top of the Agent's native goal mechanism instead of a MastraCode-specific judge loop. ([#17889](https://github.com/mastra-ai/mastra/pull/17889))

  The goal is now configured on the agent (`goal: { judge, maxRuns, prompt }`, sourced from the `goalJudgeModel` / `goalMaxTurns` settings) and evaluated **in-loop** by the core goal step, surfaced via the typed `goal` stream chunk. `GoalManager` is now a thin adapter over the agent's `setObjective` / `getObjective` / `clearObjective` / `updateObjectiveOptions` methods backed by the thread-scoped `threadState` store, so the objective persists across thread reloads and process restarts. The old between-turn judge agent (`evaluateAfterTurn`, `maybeGoalContinuation`, the judge memory/tools, and the judge-failure resume retrigger) has been removed.

  All user-facing behavior is preserved: `/goal <text>`, `/goal status|pause|resume|clear`, the goal action modal, the judge settings dialog (which now persists updated judge defaults into the active objective record), the status line, Esc-to-pause and the goal input lock, the judge display, and the plan-approval "Use as /goal" flow with plan-mode auto-switch on completion.

  The standalone `/judge` command is now the `/goal judge` subcommand, grouping judge configuration under the goal it belongs to (the judge model is only meaningful for evaluating a goal).

  The goal judge model is resolved through mastracode's model gateway (`goal.judge` is a resolver function), so provider credentials stored in auth storage are injected — previously the goal scorer received a bare model id and failed with "Could not find API key" for the configured judge. Because evaluation now happens during the run, an objective with no judge model configured anywhere is inert (no judging, no continuation).

  The raw `<current-objective>` goal state signal is suppressed in the transcript (both streamed and replayed), matching the existing behavior for the `<current-task-list>` task signal — the objective is surfaced by the goal/judge UI instead of echoed inline.

- Added MastraCode mode definitions for build, plan, and explore workflows using the shared harness mode model. ([#17892](https://github.com/mastra-ai/mastra/pull/17892))

### Patch Changes

- Enable the alpha browser video recording tools for Mastra Code's browser integration. Mastra Code now opts its configured browser provider into recording and stores videos in the app-data `browser-recordings` directory. ([#17028](https://github.com/mastra-ai/mastra/pull/17028))

  Agents can use `browser_record` to start, stop, and check recording status, then use `browser_record_caption` to add short captions that are burned into the saved Motion-JPEG AVI video.

- Fixed mastracode silently writing all tracing/observability data to the main libsql database even when /observability was never configured. The MastraStorageExporter now only activates when local DuckDB tracing is explicitly enabled via `/observability local on`, preventing the mastra_ai_spans table from growing to tens or hundreds of gigabytes. ([#18033](https://github.com/mastra-ai/mastra/pull/18033))

- Moved MastraCode model catalog and gateway-backed model resolution out of the core harness and into a class-backed MastraCode gateway, with model IDs resolving directly to gateway-created provider instances. ([#17913](https://github.com/mastra-ai/mastra/pull/17913))

- Migrated from deprecated @mariozechner/pi-tui to @earendil-works/pi-tui. Mastra Code now requires Node.js 22.19.0 or newer to match the new terminal UI dependency. ([#17974](https://github.com/mastra-ai/mastra/pull/17974))

- dependencies updates: ([#17846](https://github.com/mastra-ai/mastra/pull/17846))
  - Updated dependency [`posthog-node@^5.37.0` ↗︎](https://www.npmjs.com/package/posthog-node/v/5.37.0) (from `^5.28.3`, in `dependencies`)

- Fixed claude-fable-5 requests failing with "Invalid request: fallbacks: Extra inputs are not permitted" when logged in with Claude Max OAuth. The OAuth fetch wrapper was overwriting the anthropic-beta header, dropping the server-side-fallback beta that the automatic fable-5 fallback configuration requires. Request betas are now merged with the OAuth-required betas instead of being replaced. ([#17897](https://github.com/mastra-ai/mastra/pull/17897))

- Moved Mastra Code model discovery and resolution onto its gateway configuration. ([#17913](https://github.com/mastra-ai/mastra/pull/17913))

- Fixed TUI chat spacing so message layout stays stable while the assistant streams. Chat spacing now runs through a single boundary-spacing pass, preventing flicker from dynamic spacer recomputation, avoiding stacked or missing blank lines, and keeping custom slash command previews consistently spaced as responses begin. ([#17979](https://github.com/mastra-ai/mastra/pull/17979))

- Fixed harness modes so they can reuse configured agents and resolve their default models before running. ([#17892](https://github.com/mastra-ai/mastra/pull/17892))

- Fixed cross-instance output leaking between mastracode TUI tabs after /new. The /new command now fully unsubscribes from the old thread's PubSub topic instead of only aborting the current run, preventing another mc instance on the same thread from pushing events into the detached TUI. ([#17883](https://github.com/mastra-ai/mastra/pull/17883))

- Updated dependencies [[`de66bb0`](https://github.com/mastra-ai/mastra/commit/de66bb040570444c702ce4d8e1e228a5de2949cb), [`67bf8e2`](https://github.com/mastra-ai/mastra/commit/67bf8e206dfe583954d96015cf0d09f7ac50e45f), [`8216d05`](https://github.com/mastra-ai/mastra/commit/8216d0528d866eb9a07f5d4c87ea3bb1e1139b45), [`d18b23c`](https://github.com/mastra-ai/mastra/commit/d18b23c5e29dfc381e73e3c51fcf6c779afd1823), [`8216d05`](https://github.com/mastra-ai/mastra/commit/8216d0528d866eb9a07f5d4c87ea3bb1e1139b45), [`bec2f15`](https://github.com/mastra-ai/mastra/commit/bec2f151d01f61f41dc45538a1ab8f80bad260d8), [`5eb94eb`](https://github.com/mastra-ai/mastra/commit/5eb94ebcf66d4e28c9e26d5821ac93379bab20a0), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`f9ee2ac`](https://github.com/mastra-ai/mastra/commit/f9ee2ac661af584e61bc063ac208c9035cd752ef), [`c853d53`](https://github.com/mastra-ai/mastra/commit/c853d535d2df84ab89db1adb4c28900c54c9a2d2), [`d8df1f8`](https://github.com/mastra-ai/mastra/commit/d8df1f8e947e1966c9d4e54713df56d0d0d65226), [`9192ddb`](https://github.com/mastra-ai/mastra/commit/9192ddbced8949113b30de444cbe763f075b59f5), [`ae96523`](https://github.com/mastra-ai/mastra/commit/ae965231f562d9766b0c90c49a69fc68acaa031c), [`17d5a92`](https://github.com/mastra-ai/mastra/commit/17d5a9211aa293b4d4418de3de70dc0394d58101), [`5573693`](https://github.com/mastra-ai/mastra/commit/5573693b589822250e20dfe6cf66e9ff3bc96da8), [`ec4da8a`](https://github.com/mastra-ai/mastra/commit/ec4da8a09e0d2ab452c6ee2c786042ea826b77e5), [`adc44e1`](https://github.com/mastra-ai/mastra/commit/adc44e13c7e570b91e86b20ea7556e61d819db31), [`218d952`](https://github.com/mastra-ai/mastra/commit/218d952ec09e5111c10ccd143b5bc0ef19434376), [`7c987b4`](https://github.com/mastra-ai/mastra/commit/7c987b4cfcc498bb579f986d07f794633f8e0ff8), [`ed346c0`](https://github.com/mastra-ai/mastra/commit/ed346c0bee2d8496690a4e538bfba1e46894660f), [`9b1adf7`](https://github.com/mastra-ai/mastra/commit/9b1adf7f39943c869182106bc4016e793b3304ac), [`c9ce1b2`](https://github.com/mastra-ai/mastra/commit/c9ce1b28d10871110648f9d7b6d76e880b9fa999), [`81fe587`](https://github.com/mastra-ai/mastra/commit/81fe587275035715c1720ddf3fee0505cf053036), [`3ef01fd`](https://github.com/mastra-ai/mastra/commit/3ef01fd130b53d5bd4f828beb174e516a2eb1158), [`4572357`](https://github.com/mastra-ai/mastra/commit/45723576c19602ba28528d498399c67e2efc86f4), [`245a9a3`](https://github.com/mastra-ai/mastra/commit/245a9a315705fce17ddd980f78a92504b6615c4a), [`dc0b611`](https://github.com/mastra-ai/mastra/commit/dc0b6119b769bd00ee2c5df9259fb376fe63077a), [`38b5de8`](https://github.com/mastra-ai/mastra/commit/38b5de8e5d1d41a69522addf53d96f4b3a1d5bf0), [`eae1556`](https://github.com/mastra-ai/mastra/commit/eae1556eedac109b67d91b627689cdf70a83bab7), [`efe917d`](https://github.com/mastra-ai/mastra/commit/efe917d524f285d9d131804027c7201bf7aee110), [`b9ac4c3`](https://github.com/mastra-ai/mastra/commit/b9ac4c3ab54b0889c01d7f7285cca89a791d2351), [`dc0b611`](https://github.com/mastra-ai/mastra/commit/dc0b6119b769bd00ee2c5df9259fb376fe63077a), [`dd6a66e`](https://github.com/mastra-ai/mastra/commit/dd6a66ea0b32e0dea8059aec6b35d151e2c87dc4), [`d785c59`](https://github.com/mastra-ai/mastra/commit/d785c593b67fcb4cdc4fab9fdbde5f3b7665efc0), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`8b984f4`](https://github.com/mastra-ai/mastra/commit/8b984f4361c202270ceb69257185c4756c9a7c56), [`bf08402`](https://github.com/mastra-ai/mastra/commit/bf084022374fa5d06ca70ed67a86dd64e379071b), [`81fe587`](https://github.com/mastra-ai/mastra/commit/81fe587275035715c1720ddf3fee0505cf053036), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`403c438`](https://github.com/mastra-ai/mastra/commit/403c438e417278989ce247233d2c465b8d902cdd), [`f8ba195`](https://github.com/mastra-ai/mastra/commit/f8ba1954e27ee2b20586cc6cd9cf13c002c232f2)]:
  - @mastra/core@1.43.0
  - @mastra/tavily@1.0.3
  - @mastra/memory@1.20.4
  - @mastra/observability@1.14.2
  - @mastra/schema-compat@1.2.12
  - @mastra/stagehand@0.2.5
  - @mastra/agent-browser@0.3.2
  - @mastra/libsql@1.13.1
  - @mastra/pg@1.13.1
  - @mastra/mcp@1.10.0

## 0.22.3

### Patch Changes

- Increased TUI chat scroll buffer from 200/100 to 5000/3000 components, so you can scroll back much further in conversation history ([#17633](https://github.com/mastra-ai/mastra/pull/17633))

- Fixed analytics user tracking to use a private persistent ID instead of the device hostname, so unique user counts are not merged across machines with common names. ([#17695](https://github.com/mastra-ai/mastra/pull/17695))

- Fixed state signal placement in streamed MastraCode output. ([#17631](https://github.com/mastra-ai/mastra/pull/17631))

- Bumped @ai-sdk/anthropic to pick up refusal stop condition (vercel/ai#15928). When Anthropic refuses a request due to usage policy, the SDK now surfaces a proper stop reason instead of silently halting the agent loop. ([#17799](https://github.com/mastra-ai/mastra/pull/17799))

- Fixed Ctrl+C / Esc not aborting while a `submit_plan` approval (or `ask_user` question) is on screen. In raw terminal mode the interrupt arrives as `\x03` to the editor, where the inline component was swallowing it and leaving the suspended run parked. Ctrl+C now falls through to the abort handler, which clears the inline prompt and aborts the parked tool suspension. ([#17817](https://github.com/mastra-ai/mastra/pull/17817))

- Fixed the GitHub PR badge in MastraCode so it animates only while GitHub polling is actively running, instead of restarting whenever the agent processes a user message. ([#17590](https://github.com/mastra-ai/mastra/pull/17590))

- Revert to harness v0 ([#17589](https://github.com/mastra-ai/mastra/pull/17589))

- Fix `request_access` granting a path but the file staying unreadable with `EACCES`. After approving access, the very next tool (e.g. `view`) could still be rejected for the path that was just granted. The grant now reliably applies to the filesystem the agent's tools actually read from, and persists before the run resumes, so reads of an approved path succeed. ([#17806](https://github.com/mastra-ai/mastra/pull/17806))

- Added agent and workspace tool hooks for applications that need to run logic before and after tool calls execute. Mastra Code now uses agent hooks so hook handlers run for built-in workspace tools as well as dynamic tools. ([#17637](https://github.com/mastra-ai/mastra/pull/17637))

  **Example**

  ```ts
  const agent = new Agent({
    name: 'Support Agent',
    instructions: 'Help users.',
    model,
    hooks: {
      beforeToolCall: ({ toolName, input }) => {
        console.log(`Running ${toolName}`, input);
      },
      afterToolCall: ({ toolName, output, error }) => {
        console.log(`Finished ${toolName}`, { output, error });
      },
    },
  });

  const workspace = new Workspace({
    tools: {
      hooks: {
        beforeToolCall: ({ toolName, workspaceToolName, input }) => {
          console.log(`Running ${toolName} from ${workspaceToolName}`, input);
        },
      },
    },
  });
  ```

- Added interface-first model gateways while keeping the existing `MastraModelGateway` base class backwards compatible. ([#17608](https://github.com/mastra-ai/mastra/pull/17608))

  Added `MastraModelGatewayInterface` for plain object/custom gateway implementations and optional gateway `resolveAuth` hooks.

  Moved MastraCode gateway-routed OAuth model construction into a custom Mastra gateway so `ModelRouterLanguageModel` can route through gateway `resolveAuth` and provider-specific `resolveLanguageModel` behavior.

  **Usage:**

  ```typescript
  import { MastraModelGatewayInterface, ModelRouterLanguageModel } from '@mastra/core/llm';

  const myGateway: MastraModelGatewayInterface = {
    id: 'my-gateway',
    name: 'My Gateway',
    async fetchProviders() {
      return {};
    },
    buildUrl() {
      return 'https://api.example.com';
    },
    async getApiKey() {
      return process.env.API_KEY ?? '';
    },
    // Optional: own authentication lookup
    async resolveAuth(request) {
      return { apiKey: process.env.API_KEY, source: 'gateway' };
    },
    async resolveLanguageModel({ modelId, providerId, apiKey }) {
      // Return an AI SDK language model instance
    },
  };

  // Register and route through the gateway
  const router = new ModelRouterLanguageModel({ modelId: 'my-gateway/provider/model' }, [myGateway]);
  ```

  **Additional changes in this release:**
  - Inline three-tier auth resolution (explicit → gateway.resolveAuth → legacy getApiKey) into `ModelRouterLanguageModel.resolveAuth` and deprecate the standalone `resolveModelAuth` helper.
  - Fix `defaultGateways` deduplication in the `Mastra` class to use `getGatewayId(gateway)` instead of registry keys.
  - Remove no-op `resolveModelId` identity function in mastracode in favor of direct usage.
  - Fix `defaultNameGenerator` regex in `_llm-recorder` to anchor directory matches to path boundaries (prevents false matches like `-auth` suffixes).

- Fixed model selection being lost so the agent no longer prompts you to choose a model after you've already selected a models pack. The harness state schema was dropping the selected model id, leaving every pack (built-in or custom) with no active model. ([#17676](https://github.com/mastra-ai/mastra/pull/17676))

- Updated dependencies [[`81423f2`](https://github.com/mastra-ai/mastra/commit/81423f27c6a5979c01d63393060174ca6bf5ff04), [`81423f2`](https://github.com/mastra-ai/mastra/commit/81423f27c6a5979c01d63393060174ca6bf5ff04), [`81423f2`](https://github.com/mastra-ai/mastra/commit/81423f27c6a5979c01d63393060174ca6bf5ff04), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`0c86326`](https://github.com/mastra-ai/mastra/commit/0c8632685adf25ebacf82b239da6bc1f227f5e85), [`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`053735a`](https://github.com/mastra-ai/mastra/commit/053735a75c2c18e23ce34d9468007efa4a45f4c4), [`b421783`](https://github.com/mastra-ai/mastra/commit/b421783f8a16447436d3d0c89ea3dd8f0c558786), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`bec4678`](https://github.com/mastra-ai/mastra/commit/bec46781f31a2760b09b4aade1a87a62a40bee7b), [`f86b997`](https://github.com/mastra-ai/mastra/commit/f86b997e63a6ffc3503473835f2cfe0ed2ac8337), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`e9be4e7`](https://github.com/mastra-ai/mastra/commit/e9be4e747ec3d8b65548bff92f9377db06105376), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`d53cfc2`](https://github.com/mastra-ai/mastra/commit/d53cfc2c7f8d78343a4aa84ec4e129ba25f3325e), [`65799d4`](https://github.com/mastra-ai/mastra/commit/65799d4d549e5ebb9c848fbe3f51ac090f64becf), [`c268c89`](https://github.com/mastra-ai/mastra/commit/c268c89f4c63a93ee474d3cffdf3ea60bf00d4f2), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`014e00f`](https://github.com/mastra-ai/mastra/commit/014e00f2b3a597a016b72f9901c6ab27d491f822), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`7ef9ebf`](https://github.com/mastra-ai/mastra/commit/7ef9ebf79ec3c90536643ef169c7a306f105fb9d), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`0c72f03`](https://github.com/mastra-ai/mastra/commit/0c72f032abb13254df5a7856d64be2f207b8006d), [`75adfb8`](https://github.com/mastra-ai/mastra/commit/75adfb81e3fca1fe8dc9ab382bed7b714854ba4f), [`4c2158d`](https://github.com/mastra-ai/mastra/commit/4c2158d4c2a86e82105179d4a757cd625dfec9fa), [`f222f15`](https://github.com/mastra-ai/mastra/commit/f222f15823391d04cc41a82a16fb0e780bac9ae7), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`3b45ea9`](https://github.com/mastra-ai/mastra/commit/3b45ea95015557a6cb9d70dc5252af54ab1b78ac), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`f084be1`](https://github.com/mastra-ai/mastra/commit/f084be1fcbe33ad7480913e44d6130c421c0976f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`f2ab060`](https://github.com/mastra-ai/mastra/commit/f2ab060162bea81505fda553e2cee29c1979fd04), [`5d302c8`](https://github.com/mastra-ai/mastra/commit/5d302c8eda1a6ac74eab5e442c4f64db6cc97a06), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`a952852`](https://github.com/mastra-ai/mastra/commit/a952852c971a21fb646cd907c75fcf4443cdc963), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552), [`f2ab060`](https://github.com/mastra-ai/mastra/commit/f2ab060162bea81505fda553e2cee29c1979fd04)]:
  - @mastra/duckdb@1.4.2
  - @mastra/libsql@1.13.0
  - @mastra/pg@1.13.0
  - @mastra/tavily@1.0.2
  - @mastra/core@1.42.0
  - @mastra/stagehand@0.2.4
  - @mastra/memory@1.20.3
  - @mastra/github-signals@0.1.1
  - @mastra/mcp@1.10.0
  - @mastra/agent-browser@0.3.1

## 0.22.3-alpha.4

### Patch Changes

- Fixed analytics user tracking to use a private persistent ID instead of the device hostname, so unique user counts are not merged across machines with common names. ([#17695](https://github.com/mastra-ai/mastra/pull/17695))

- Bumped @ai-sdk/anthropic to pick up refusal stop condition (vercel/ai#15928). When Anthropic refuses a request due to usage policy, the SDK now surfaces a proper stop reason instead of silently halting the agent loop. ([#17799](https://github.com/mastra-ai/mastra/pull/17799))

- Fixed Ctrl+C / Esc not aborting while a `submit_plan` approval (or `ask_user` question) is on screen. In raw terminal mode the interrupt arrives as `\x03` to the editor, where the inline component was swallowing it and leaving the suspended run parked. Ctrl+C now falls through to the abort handler, which clears the inline prompt and aborts the parked tool suspension. ([#17817](https://github.com/mastra-ai/mastra/pull/17817))

- Fix `request_access` granting a path but the file staying unreadable with `EACCES`. After approving access, the very next tool (e.g. `view`) could still be rejected for the path that was just granted. The grant now reliably applies to the filesystem the agent's tools actually read from, and persists before the run resumes, so reads of an approved path succeed. ([#17806](https://github.com/mastra-ai/mastra/pull/17806))

- Fixed model selection being lost so the agent no longer prompts you to choose a model after you've already selected a models pack. The harness state schema was dropping the selected model id, leaving every pack (built-in or custom) with no active model. ([#17676](https://github.com/mastra-ai/mastra/pull/17676))

- Updated dependencies [[`81423f2`](https://github.com/mastra-ai/mastra/commit/81423f27c6a5979c01d63393060174ca6bf5ff04), [`81423f2`](https://github.com/mastra-ai/mastra/commit/81423f27c6a5979c01d63393060174ca6bf5ff04), [`81423f2`](https://github.com/mastra-ai/mastra/commit/81423f27c6a5979c01d63393060174ca6bf5ff04), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`0c86326`](https://github.com/mastra-ai/mastra/commit/0c8632685adf25ebacf82b239da6bc1f227f5e85), [`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`b421783`](https://github.com/mastra-ai/mastra/commit/b421783f8a16447436d3d0c89ea3dd8f0c558786), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`bec4678`](https://github.com/mastra-ai/mastra/commit/bec46781f31a2760b09b4aade1a87a62a40bee7b), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`f222f15`](https://github.com/mastra-ai/mastra/commit/f222f15823391d04cc41a82a16fb0e780bac9ae7), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552)]:
  - @mastra/duckdb@1.4.2-alpha.0
  - @mastra/libsql@1.13.0-alpha.0
  - @mastra/pg@1.13.0-alpha.1
  - @mastra/tavily@1.0.2-alpha.0
  - @mastra/core@1.42.0-alpha.4
  - @mastra/stagehand@0.2.4-alpha.0
  - @mastra/memory@1.20.3-alpha.0
  - @mastra/mcp@1.10.0-alpha.1

## 0.22.3-alpha.3

### Patch Changes

- Added interface-first model gateways while keeping the existing `MastraModelGateway` base class backwards compatible. ([#17608](https://github.com/mastra-ai/mastra/pull/17608))

  Added `MastraModelGatewayInterface` for plain object/custom gateway implementations and optional gateway `resolveAuth` hooks.

  Moved MastraCode gateway-routed OAuth model construction into a custom Mastra gateway so `ModelRouterLanguageModel` can route through gateway `resolveAuth` and provider-specific `resolveLanguageModel` behavior.

  **Usage:**

  ```typescript
  import { MastraModelGatewayInterface, ModelRouterLanguageModel } from '@mastra/core/llm';

  const myGateway: MastraModelGatewayInterface = {
    id: 'my-gateway',
    name: 'My Gateway',
    async fetchProviders() {
      return {};
    },
    buildUrl() {
      return 'https://api.example.com';
    },
    async getApiKey() {
      return process.env.API_KEY ?? '';
    },
    // Optional: own authentication lookup
    async resolveAuth(request) {
      return { apiKey: process.env.API_KEY, source: 'gateway' };
    },
    async resolveLanguageModel({ modelId, providerId, apiKey }) {
      // Return an AI SDK language model instance
    },
  };

  // Register and route through the gateway
  const router = new ModelRouterLanguageModel({ modelId: 'my-gateway/provider/model' }, [myGateway]);
  ```

  **Additional changes in this release:**
  - Inline three-tier auth resolution (explicit → gateway.resolveAuth → legacy getApiKey) into `ModelRouterLanguageModel.resolveAuth` and deprecate the standalone `resolveModelAuth` helper.
  - Fix `defaultGateways` deduplication in the `Mastra` class to use `getGatewayId(gateway)` instead of registry keys.
  - Remove no-op `resolveModelId` identity function in mastracode in favor of direct usage.
  - Fix `defaultNameGenerator` regex in `_llm-recorder` to anchor directory matches to path boundaries (prevents false matches like `-auth` suffixes).

- Updated dependencies [[`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`053735a`](https://github.com/mastra-ai/mastra/commit/053735a75c2c18e23ce34d9468007efa4a45f4c4), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`a952852`](https://github.com/mastra-ai/mastra/commit/a952852c971a21fb646cd907c75fcf4443cdc963)]:
  - @mastra/core@1.42.0-alpha.3

## 0.22.3-alpha.2

### Patch Changes

- Updated dependencies [[`014e00f`](https://github.com/mastra-ai/mastra/commit/014e00f2b3a597a016b72f9901c6ab27d491f822)]:
  - @mastra/core@1.42.0-alpha.2

## 0.22.3-alpha.1

### Patch Changes

- Increased TUI chat scroll buffer from 200/100 to 5000/3000 components, so you can scroll back much further in conversation history ([#17633](https://github.com/mastra-ai/mastra/pull/17633))

- Fixed state signal placement in streamed MastraCode output. ([#17631](https://github.com/mastra-ai/mastra/pull/17631))

- Fixed the GitHub PR badge in MastraCode so it animates only while GitHub polling is actively running, instead of restarting whenever the agent processes a user message. ([#17590](https://github.com/mastra-ai/mastra/pull/17590))

- Added agent and workspace tool hooks for applications that need to run logic before and after tool calls execute. Mastra Code now uses agent hooks so hook handlers run for built-in workspace tools as well as dynamic tools. ([#17637](https://github.com/mastra-ai/mastra/pull/17637))

  **Example**

  ```ts
  const agent = new Agent({
    name: 'Support Agent',
    instructions: 'Help users.',
    model,
    hooks: {
      beforeToolCall: ({ toolName, input }) => {
        console.log(`Running ${toolName}`, input);
      },
      afterToolCall: ({ toolName, output, error }) => {
        console.log(`Finished ${toolName}`, { output, error });
      },
    },
  });

  const workspace = new Workspace({
    tools: {
      hooks: {
        beforeToolCall: ({ toolName, workspaceToolName, input }) => {
          console.log(`Running ${toolName} from ${workspaceToolName}`, input);
        },
      },
    },
  });
  ```

- Updated dependencies [[`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`f2ab060`](https://github.com/mastra-ai/mastra/commit/f2ab060162bea81505fda553e2cee29c1979fd04), [`5d302c8`](https://github.com/mastra-ai/mastra/commit/5d302c8eda1a6ac74eab5e442c4f64db6cc97a06), [`f2ab060`](https://github.com/mastra-ai/mastra/commit/f2ab060162bea81505fda553e2cee29c1979fd04)]:
  - @mastra/core@1.42.0-alpha.1
  - @mastra/github-signals@0.1.1-alpha.0
  - @mastra/agent-browser@0.3.1-alpha.0

## 0.22.3-alpha.0

### Patch Changes

- Revert to harness v0 ([#17589](https://github.com/mastra-ai/mastra/pull/17589))

- Updated dependencies [[`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`f86b997`](https://github.com/mastra-ai/mastra/commit/f86b997e63a6ffc3503473835f2cfe0ed2ac8337), [`e9be4e7`](https://github.com/mastra-ai/mastra/commit/e9be4e747ec3d8b65548bff92f9377db06105376), [`d53cfc2`](https://github.com/mastra-ai/mastra/commit/d53cfc2c7f8d78343a4aa84ec4e129ba25f3325e), [`65799d4`](https://github.com/mastra-ai/mastra/commit/65799d4d549e5ebb9c848fbe3f51ac090f64becf), [`c268c89`](https://github.com/mastra-ai/mastra/commit/c268c89f4c63a93ee474d3cffdf3ea60bf00d4f2), [`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`7ef9ebf`](https://github.com/mastra-ai/mastra/commit/7ef9ebf79ec3c90536643ef169c7a306f105fb9d), [`0c72f03`](https://github.com/mastra-ai/mastra/commit/0c72f032abb13254df5a7856d64be2f207b8006d), [`75adfb8`](https://github.com/mastra-ai/mastra/commit/75adfb81e3fca1fe8dc9ab382bed7b714854ba4f), [`4c2158d`](https://github.com/mastra-ai/mastra/commit/4c2158d4c2a86e82105179d4a757cd625dfec9fa), [`3b45ea9`](https://github.com/mastra-ai/mastra/commit/3b45ea95015557a6cb9d70dc5252af54ab1b78ac), [`f084be1`](https://github.com/mastra-ai/mastra/commit/f084be1fcbe33ad7480913e44d6130c421c0976f)]:
  - @mastra/core@1.42.0-alpha.0
  - @mastra/pg@1.13.0-alpha.0
  - @mastra/mcp@1.9.2-alpha.0

## 0.22.2

### Patch Changes

- Fixed thread isolation bug where /new command did not abort the running stream, causing events from the old thread (subagent results, tool approvals, task updates) to leak into the new conversation. ([#17565](https://github.com/mastra-ai/mastra/pull/17565))

- Updated dependencies [[`f82cc72`](https://github.com/mastra-ai/mastra/commit/f82cc72edca0ce636fe18abaf2598d89a0c6bcca), [`fcf6027`](https://github.com/mastra-ai/mastra/commit/fcf602747f6771731dda268ff3493b836f9f0ee9)]:
  - @mastra/core@1.41.0

## 0.22.2-alpha.1

### Patch Changes

- Fixed thread isolation bug where /new command did not abort the running stream, causing events from the old thread (subagent results, tool approvals, task updates) to leak into the new conversation. ([#17565](https://github.com/mastra-ai/mastra/pull/17565))

## 0.22.2-alpha.0

### Patch Changes

- Updated dependencies [[`f82cc72`](https://github.com/mastra-ai/mastra/commit/f82cc72edca0ce636fe18abaf2598d89a0c6bcca), [`fcf6027`](https://github.com/mastra-ai/mastra/commit/fcf602747f6771731dda268ff3493b836f9f0ee9)]:
  - @mastra/core@1.41.0-alpha.0

## 0.22.1

### Patch Changes

- Auto-subscribe to the current branch's PR via GitHub Signals at the end of each agent run. When experimental GitHub Signals are enabled in /settings and the checked-out branch has an open PR, the thread is automatically subscribed (once per thread, fire-and-forget). ([#17538](https://github.com/mastra-ai/mastra/pull/17538))

- Updated dependencies [[`ae1fa3a`](https://github.com/mastra-ai/mastra/commit/ae1fa3a9c40510f1e068ffc2345cf09f9ee32b26)]:
  - @mastra/core@1.40.0

## 0.22.1-alpha.0

### Patch Changes

- Auto-subscribe to the current branch's PR via GitHub Signals at the end of each agent run. When experimental GitHub Signals are enabled in /settings and the checked-out branch has an open PR, the thread is automatically subscribed (once per thread, fire-and-forget). ([#17538](https://github.com/mastra-ai/mastra/pull/17538))

- Updated dependencies [[`ae1fa3a`](https://github.com/mastra-ai/mastra/commit/ae1fa3a9c40510f1e068ffc2345cf09f9ee32b26)]:
  - @mastra/core@1.40.0-alpha.0

## 0.22.0

### Minor Changes

- Add a /notify command that opens a modal composer, sends agent notifications from MastraCode, dispatches due notification summaries in the background, and exposes the notification inbox tool to inspect summarized notifications. ([#17241](https://github.com/mastra-ai/mastra/pull/17241))

### Patch Changes

- Added GitHub PR notifications in Mastra Code with subscription management, manual sync, PR status badges, subscription hints, automatic merged PR cleanup, and inbox access. ([#17447](https://github.com/mastra-ai/mastra/pull/17447))

- Fixed mode switching crash when no active thread exists. Previously, pressing Shift+Tab to cycle modes before sending a first message would cause a fatal error. ([#17511](https://github.com/mastra-ai/mastra/pull/17511))

- Updated dependencies [[`c973db4`](https://github.com/mastra-ai/mastra/commit/c973db428df1b564ff0c35d4b2a90e8f4f1e13fd), [`552285e`](https://github.com/mastra-ai/mastra/commit/552285e5af43cfc680a0972032cab8de8776c6a0), [`77e686c`](https://github.com/mastra-ai/mastra/commit/77e686c264e493e99ae5024e4dfe3ea5d5a09718), [`e751af2`](https://github.com/mastra-ai/mastra/commit/e751af219433fbf4c7035b2d771b4c9ec8813b05), [`e751af2`](https://github.com/mastra-ai/mastra/commit/e751af219433fbf4c7035b2d771b4c9ec8813b05), [`ece8dba`](https://github.com/mastra-ai/mastra/commit/ece8dba7ec1a5089eee8c33167cd762bfa91e509), [`e751af2`](https://github.com/mastra-ai/mastra/commit/e751af219433fbf4c7035b2d771b4c9ec8813b05), [`be3f1cd`](https://github.com/mastra-ai/mastra/commit/be3f1cd81f0e2a649e8eac15a024d542d814aef8), [`43dd577`](https://github.com/mastra-ai/mastra/commit/43dd577aa2b056b86b92cb903433f4fc13e69687), [`e2a8380`](https://github.com/mastra-ai/mastra/commit/e2a838017a7657850404c1e94c70d79ffdc6f14a), [`be3f1cd`](https://github.com/mastra-ai/mastra/commit/be3f1cd81f0e2a649e8eac15a024d542d814aef8), [`a34d9db`](https://github.com/mastra-ai/mastra/commit/a34d9dbc39fedb722f271318e9355ecee70489ab)]:
  - @mastra/core@1.39.0
  - @mastra/mcp@1.9.1
  - @mastra/libsql@1.12.1
  - @mastra/pg@1.12.1
  - @mastra/memory@1.20.2

## 0.22.0-alpha.0

### Minor Changes

- Add a /notify command that opens a modal composer, sends agent notifications from MastraCode, dispatches due notification summaries in the background, and exposes the notification inbox tool to inspect summarized notifications. ([#17241](https://github.com/mastra-ai/mastra/pull/17241))

### Patch Changes

- Added GitHub PR notifications in Mastra Code with subscription management, manual sync, PR status badges, subscription hints, automatic merged PR cleanup, and inbox access. ([#17447](https://github.com/mastra-ai/mastra/pull/17447))

- Fixed mode switching crash when no active thread exists. Previously, pressing Shift+Tab to cycle modes before sending a first message would cause a fatal error. ([#17511](https://github.com/mastra-ai/mastra/pull/17511))

- Updated dependencies [[`c973db4`](https://github.com/mastra-ai/mastra/commit/c973db428df1b564ff0c35d4b2a90e8f4f1e13fd), [`552285e`](https://github.com/mastra-ai/mastra/commit/552285e5af43cfc680a0972032cab8de8776c6a0), [`77e686c`](https://github.com/mastra-ai/mastra/commit/77e686c264e493e99ae5024e4dfe3ea5d5a09718), [`e751af2`](https://github.com/mastra-ai/mastra/commit/e751af219433fbf4c7035b2d771b4c9ec8813b05), [`e751af2`](https://github.com/mastra-ai/mastra/commit/e751af219433fbf4c7035b2d771b4c9ec8813b05), [`ece8dba`](https://github.com/mastra-ai/mastra/commit/ece8dba7ec1a5089eee8c33167cd762bfa91e509), [`e751af2`](https://github.com/mastra-ai/mastra/commit/e751af219433fbf4c7035b2d771b4c9ec8813b05), [`be3f1cd`](https://github.com/mastra-ai/mastra/commit/be3f1cd81f0e2a649e8eac15a024d542d814aef8), [`43dd577`](https://github.com/mastra-ai/mastra/commit/43dd577aa2b056b86b92cb903433f4fc13e69687), [`e2a8380`](https://github.com/mastra-ai/mastra/commit/e2a838017a7657850404c1e94c70d79ffdc6f14a), [`be3f1cd`](https://github.com/mastra-ai/mastra/commit/be3f1cd81f0e2a649e8eac15a024d542d814aef8), [`a34d9db`](https://github.com/mastra-ai/mastra/commit/a34d9dbc39fedb722f271318e9355ecee70489ab)]:
  - @mastra/core@1.39.0-alpha.0
  - @mastra/mcp@1.9.1-alpha.0
  - @mastra/libsql@1.12.1-alpha.0
  - @mastra/pg@1.12.1-alpha.0
  - @mastra/memory@1.20.2-alpha.0

## 0.21.2

### Patch Changes

- Added configurable shell passthrough for direct TUI `!` commands. You can now choose which shell runs `!` commands via `settings.json` or environment variables, with support for POSIX shells, `cmd.exe`, and PowerShell. ([#17283](https://github.com/mastra-ai/mastra/pull/17283))

  ```json
  {
    "shellPassthrough": {
      "mode": "path",
      "executable": "/bin/zsh",
      "family": "posix"
    }
  }
  ```

  Or via environment variables:

  ```sh
  export MASTRACODE_SHELL=/bin/zsh
  export MASTRACODE_SHELL_MODE=path
  ```

  The default behavior is preserved when no configuration is set.

- Fixed the `ask_user` tool's `multi_select` mode in Mastra Code, which previously rendered as a single-select list and returned only one answer. ([#17334](https://github.com/mastra-ai/mastra/pull/17334))

  When an agent calls `ask_user` with `selectionMode: "multi_select"`, the CLI now shows a multi-select picker — press Space to toggle each option and Enter to confirm — and returns every selected label to the agent as an array instead of a single string.

- Fixed TUI crash on narrow terminals when prompt dialogs render lines wider than terminal width ([#17431](https://github.com/mastra-ai/mastra/pull/17431))

- Wrap long slash-command and skill descriptions in the autocomplete picker instead of truncating them on a single line. The picker dropdown now word-wraps descriptions across multiple rows (continuation rows indented under the description column), so long command/skill descriptions stay fully readable without widening the terminal. ([#17333](https://github.com/mastra-ai/mastra/pull/17333))

- Updated dependencies [[`b0771a4`](https://github.com/mastra-ai/mastra/commit/b0771a48b46e46d270fca208a587922f3b7104a8), [`00eca42`](https://github.com/mastra-ai/mastra/commit/00eca4252393aa114dc8c9a5e1da68df91fa06cf), [`fa63872`](https://github.com/mastra-ai/mastra/commit/fa6387280954e6b667bec5714b55ba082bc627ff), [`d779de3`](https://github.com/mastra-ai/mastra/commit/d779de3cd9d2e7ed8110547190e2f15e786a0e41), [`1750c97`](https://github.com/mastra-ai/mastra/commit/1750c975d6179fbf6db2813b15229d4f8f23fc55), [`9283971`](https://github.com/mastra-ai/mastra/commit/928397157009b4aef4d5fdf3a0a273cb371beb55), [`f07b646`](https://github.com/mastra-ai/mastra/commit/f07b64604ab7d25391179790b7fd4823df9e2dff), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`40f9297`](https://github.com/mastra-ai/mastra/commit/40f9297003b921c62373d3e8d3a4bda76c9f6de3), [`19a8658`](https://github.com/mastra-ai/mastra/commit/19a86589c788ef48bb6c1b0612cc82a201857379), [`850af77`](https://github.com/mastra-ai/mastra/commit/850af7779cb87c350804488734544a5b1843de25), [`82785f6`](https://github.com/mastra-ai/mastra/commit/82785f614bad7936ecbdcb526673f8da47779731), [`0f0d1ba`](https://github.com/mastra-ai/mastra/commit/0f0d1ba67bfcb2204e571401662f1eceefc03357), [`a18775a`](https://github.com/mastra-ai/mastra/commit/a18775a693172546ee2378d39b67d4e32895b251), [`1baf2d1`](https://github.com/mastra-ai/mastra/commit/1baf2d152c6881338ff8f114633d5316fe13dd15), [`8c31bcd`](https://github.com/mastra-ai/mastra/commit/8c31bcdb00e597880d5939b1b7d7566fbe5dacae), [`0e32507`](https://github.com/mastra-ai/mastra/commit/0e32507962cdfa5569b7bda5bc6fb3dd34e40b03), [`95b14cd`](https://github.com/mastra-ai/mastra/commit/95b14cdd820e86d97ac05fe568424c513a252e31), [`2c79486`](https://github.com/mastra-ai/mastra/commit/2c79486e1a812db9bfc8fd25a93dd47359b330e7), [`07c3de7`](https://github.com/mastra-ai/mastra/commit/07c3de7f7bc418beccaea3b5e6b7f7cdda79d492), [`0bf2d93`](https://github.com/mastra-ai/mastra/commit/0bf2d932d20e2936f2d9abb8c0a86e24fbc97ec6), [`7b0d34c`](https://github.com/mastra-ai/mastra/commit/7b0d34cfe4a2fce22ac86ae17404685ff67a2ddb), [`cb137cd`](https://github.com/mastra-ai/mastra/commit/cb137cdeed7c15ea4e8061f79d1d55d2ecea74d7), [`a659a77`](https://github.com/mastra-ai/mastra/commit/a659a779bdebe3a52a518c56d2260592d0240fe0), [`0e51c36`](https://github.com/mastra-ai/mastra/commit/0e51c362be673502ac79626a75d1416479b0b76e), [`aa36be2`](https://github.com/mastra-ai/mastra/commit/aa36be23aa513b7dc53cb8ca16b7fab8f20e43ad), [`8260167`](https://github.com/mastra-ai/mastra/commit/8260167431f98400f3acef4bbb7bd6027efd7a4b), [`3332be9`](https://github.com/mastra-ai/mastra/commit/3332be9701ecd77aba840959d9a1d1ce7aef02d3), [`212c635`](https://github.com/mastra-ai/mastra/commit/212c635203e61d036ab41db8ff86c3893dc795b3), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`9aa5a73`](https://github.com/mastra-ai/mastra/commit/9aa5a73e7e110f6e9365eec69364a33d5f03bb56), [`f73c789`](https://github.com/mastra-ai/mastra/commit/f73c789e8ef21561580395d2c410119cab5848c8), [`8bd16da`](https://github.com/mastra-ai/mastra/commit/8bd16da73a4cb874d739373643dbd6a6e7f88684), [`09be9d9`](https://github.com/mastra-ai/mastra/commit/09be9d92043fc8db5b82319a729071ebfee26cca), [`c8630f8`](https://github.com/mastra-ai/mastra/commit/c8630f80d4f40cb5d22e60ab162b618b1907167a), [`8cdde58`](https://github.com/mastra-ai/mastra/commit/8cdde5875bbba6702d9df226f2b20232b8d75d6c), [`94dfef6`](https://github.com/mastra-ai/mastra/commit/94dfef6e2bf19a88467ea3940afcbce88a433f0f), [`47f71dc`](https://github.com/mastra-ai/mastra/commit/47f71dc6fbcbd12d71e21a979e676e20a02bd77d), [`e191065`](https://github.com/mastra-ai/mastra/commit/e191065af6039cf6388e05aa2b84f6f5d69af4c9), [`50ceae2`](https://github.com/mastra-ai/mastra/commit/50ceae270878e2f8fb2b2c6c2faab09df0007c8a), [`a122f79`](https://github.com/mastra-ai/mastra/commit/a122f79427ae225ec79c7b2ed46278da48d04b17), [`8cdde58`](https://github.com/mastra-ai/mastra/commit/8cdde5875bbba6702d9df226f2b20232b8d75d6c), [`3a081c1`](https://github.com/mastra-ai/mastra/commit/3a081c1255c5ae8c99f6dad91cc612934ef6f2bd), [`49f8abc`](https://github.com/mastra-ai/mastra/commit/49f8abce8258e4f2f87bd326acfbdb641264a47c), [`847ff1e`](https://github.com/mastra-ai/mastra/commit/847ff1e0d94368d94b2e173e4e0908e115568ef3), [`0c1ed1d`](https://github.com/mastra-ai/mastra/commit/0c1ed1d00c7d87b5ac99ca95896211a2fa9189fa), [`259d409`](https://github.com/mastra-ai/mastra/commit/259d409a514174299dbde1ff5e1121209b3ba850), [`9e16c68`](https://github.com/mastra-ai/mastra/commit/9e16c6818b6485ccb43df28aba6f3a2219d28662), [`a3372df`](https://github.com/mastra-ai/mastra/commit/a3372dfaf107461f47fb50a6f90088fa01d87567), [`cefca33`](https://github.com/mastra-ai/mastra/commit/cefca33ae666e69810c935fedf95a929c173d1d7), [`d00e8c5`](https://github.com/mastra-ai/mastra/commit/d00e8c50daebe5bce5bf2f48bde39c86fc3d2fe4), [`36fa7e2`](https://github.com/mastra-ai/mastra/commit/36fa7e24d14e58a1eb46147097b32f583e5b8775), [`87e9774`](https://github.com/mastra-ai/mastra/commit/87e97741c1e493cd6d62f478eb810b49bda4d57c), [`65a72e7`](https://github.com/mastra-ai/mastra/commit/65a72e70c25eedea8ff985a6624b96be2850236b), [`fe9eacd`](https://github.com/mastra-ai/mastra/commit/fe9eacd9545a0a9d64aad31c9fa90294a425289e), [`4c02027`](https://github.com/mastra-ai/mastra/commit/4c020277235eaa6b1dc957c90ad0639eef213992), [`0f77241`](https://github.com/mastra-ai/mastra/commit/0f7724108806703799a8ba80ad0f09414afd5066), [`e36253f`](https://github.com/mastra-ai/mastra/commit/e36253f0cbe1900f84e6eeaa3e0343d66ec1fce3), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`f79df90`](https://github.com/mastra-ai/mastra/commit/f79df90e922c7985677c07d49d8fcf3afd2080c2), [`849efb9`](https://github.com/mastra-ai/mastra/commit/849efb9fca6dc976589c1f90a303fea618769109), [`92ff509`](https://github.com/mastra-ai/mastra/commit/92ff5098ef8a990438ca038077021a5f7541ec1d), [`3fce5e7`](https://github.com/mastra-ai/mastra/commit/3fce5e70d011d289043e75003ef3336ed4aa43c3), [`a763592`](https://github.com/mastra-ai/mastra/commit/a763592c3db46963ef1011cfe16fe372816e775e), [`db79c86`](https://github.com/mastra-ai/mastra/commit/db79c86c60723d57e02f9636ca2611bd4515f194), [`6855012`](https://github.com/mastra-ai/mastra/commit/685501247cc4717506f3e89beed03509d63a5370), [`80c7737`](https://github.com/mastra-ai/mastra/commit/80c7737e32d7917b5f356957d67c169d01744fd3), [`9f9a8dc`](https://github.com/mastra-ai/mastra/commit/9f9a8dc97684a0a9879390faf4525f3225ef8453), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`ab3b611`](https://github.com/mastra-ai/mastra/commit/ab3b611d086c07d7e0c9ece270b51fc17b9f54b8), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`3f1cf47`](https://github.com/mastra-ai/mastra/commit/3f1cf476f74c1e4cc2df908837e05853a5347e31), [`ff9d743`](https://github.com/mastra-ai/mastra/commit/ff9d743f71d7e072927725c0d700632aca0c1fee)]:
  - @mastra/agent-browser@0.3.0
  - @mastra/schema-compat@1.2.11
  - @mastra/core@1.38.0
  - @mastra/mcp@1.9.0
  - @mastra/observability@1.14.1
  - @mastra/fastembed@1.1.2
  - @mastra/libsql@1.12.0
  - @mastra/duckdb@1.4.1
  - @mastra/memory@1.20.1
  - @mastra/pg@1.12.0

## 0.21.2-alpha.9

### Patch Changes

- Updated dependencies [[`850af77`](https://github.com/mastra-ai/mastra/commit/850af7779cb87c350804488734544a5b1843de25), [`7b0d34c`](https://github.com/mastra-ai/mastra/commit/7b0d34cfe4a2fce22ac86ae17404685ff67a2ddb)]:
  - @mastra/core@1.38.0-alpha.9

## 0.21.2-alpha.8

### Patch Changes

- Updated dependencies [[`0c1ed1d`](https://github.com/mastra-ai/mastra/commit/0c1ed1d00c7d87b5ac99ca95896211a2fa9189fa), [`849efb9`](https://github.com/mastra-ai/mastra/commit/849efb9fca6dc976589c1f90a303fea618769109)]:
  - @mastra/core@1.38.0-alpha.8
  - @mastra/mcp@1.9.0-alpha.1

## 0.21.2-alpha.7

### Patch Changes

- Updated dependencies [[`e36253f`](https://github.com/mastra-ai/mastra/commit/e36253f0cbe1900f84e6eeaa3e0343d66ec1fce3)]:
  - @mastra/observability@1.14.1-alpha.1
  - @mastra/core@1.38.0-alpha.7

## 0.21.2-alpha.6

### Patch Changes

- Fixed TUI crash on narrow terminals when prompt dialogs render lines wider than terminal width ([#17431](https://github.com/mastra-ai/mastra/pull/17431))

- Updated dependencies [[`b0771a4`](https://github.com/mastra-ai/mastra/commit/b0771a48b46e46d270fca208a587922f3b7104a8), [`19a8658`](https://github.com/mastra-ai/mastra/commit/19a86589c788ef48bb6c1b0612cc82a201857379), [`a659a77`](https://github.com/mastra-ai/mastra/commit/a659a779bdebe3a52a518c56d2260592d0240fe0), [`3332be9`](https://github.com/mastra-ai/mastra/commit/3332be9701ecd77aba840959d9a1d1ce7aef02d3)]:
  - @mastra/agent-browser@0.3.0-alpha.1
  - @mastra/core@1.38.0-alpha.6

## 0.21.2-alpha.5

### Patch Changes

- Updated dependencies [[`a18775a`](https://github.com/mastra-ai/mastra/commit/a18775a693172546ee2378d39b67d4e32895b251), [`1baf2d1`](https://github.com/mastra-ai/mastra/commit/1baf2d152c6881338ff8f114633d5316fe13dd15), [`8260167`](https://github.com/mastra-ai/mastra/commit/8260167431f98400f3acef4bbb7bd6027efd7a4b)]:
  - @mastra/core@1.38.0-alpha.5
  - @mastra/duckdb@1.4.1-alpha.0

## 0.21.2-alpha.4

### Patch Changes

- Updated dependencies [[`50ed00c`](https://github.com/mastra-ai/mastra/commit/50ed00caa914a85969b33de83f26b48e328ef641), [`9283971`](https://github.com/mastra-ai/mastra/commit/928397157009b4aef4d5fdf3a0a273cb371beb55), [`0bf2d93`](https://github.com/mastra-ai/mastra/commit/0bf2d932d20e2936f2d9abb8c0a86e24fbc97ec6), [`94dfef6`](https://github.com/mastra-ai/mastra/commit/94dfef6e2bf19a88467ea3940afcbce88a433f0f), [`a122f79`](https://github.com/mastra-ai/mastra/commit/a122f79427ae225ec79c7b2ed46278da48d04b17), [`4c02027`](https://github.com/mastra-ai/mastra/commit/4c020277235eaa6b1dc957c90ad0639eef213992), [`6855012`](https://github.com/mastra-ai/mastra/commit/685501247cc4717506f3e89beed03509d63a5370), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23)]:
  - @mastra/core@1.38.0-alpha.4

## 0.21.2-alpha.3

### Patch Changes

- Added configurable shell passthrough for direct TUI `!` commands. You can now choose which shell runs `!` commands via `settings.json` or environment variables, with support for POSIX shells, `cmd.exe`, and PowerShell. ([#17283](https://github.com/mastra-ai/mastra/pull/17283))

  ```json
  {
    "shellPassthrough": {
      "mode": "path",
      "executable": "/bin/zsh",
      "family": "posix"
    }
  }
  ```

  Or via environment variables:

  ```sh
  export MASTRACODE_SHELL=/bin/zsh
  export MASTRACODE_SHELL_MODE=path
  ```

  The default behavior is preserved when no configuration is set.

- Fixed the `ask_user` tool's `multi_select` mode in Mastra Code, which previously rendered as a single-select list and returned only one answer. ([#17334](https://github.com/mastra-ai/mastra/pull/17334))

  When an agent calls `ask_user` with `selectionMode: "multi_select"`, the CLI now shows a multi-select picker — press Space to toggle each option and Enter to confirm — and returns every selected label to the agent as an array instead of a single string.

- Wrap long slash-command and skill descriptions in the autocomplete picker instead of truncating them on a single line. The picker dropdown now word-wraps descriptions across multiple rows (continuation rows indented under the description column), so long command/skill descriptions stay fully readable without widening the terminal. ([#17333](https://github.com/mastra-ai/mastra/pull/17333))

- Updated dependencies [[`00eca42`](https://github.com/mastra-ai/mastra/commit/00eca4252393aa114dc8c9a5e1da68df91fa06cf), [`8ace89d`](https://github.com/mastra-ai/mastra/commit/8ace89df77f762e622d3b9f7f65ad7524350d050), [`fa63872`](https://github.com/mastra-ai/mastra/commit/fa6387280954e6b667bec5714b55ba082bc627ff), [`f07b646`](https://github.com/mastra-ai/mastra/commit/f07b64604ab7d25391179790b7fd4823df9e2dff), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`40f9297`](https://github.com/mastra-ai/mastra/commit/40f9297003b921c62373d3e8d3a4bda76c9f6de3), [`82785f6`](https://github.com/mastra-ai/mastra/commit/82785f614bad7936ecbdcb526673f8da47779731), [`0f0d1ba`](https://github.com/mastra-ai/mastra/commit/0f0d1ba67bfcb2204e571401662f1eceefc03357), [`8c31bcd`](https://github.com/mastra-ai/mastra/commit/8c31bcdb00e597880d5939b1b7d7566fbe5dacae), [`95b14cd`](https://github.com/mastra-ai/mastra/commit/95b14cdd820e86d97ac05fe568424c513a252e31), [`2c79486`](https://github.com/mastra-ai/mastra/commit/2c79486e1a812db9bfc8fd25a93dd47359b330e7), [`cb137cd`](https://github.com/mastra-ai/mastra/commit/cb137cdeed7c15ea4e8061f79d1d55d2ecea74d7), [`0e51c36`](https://github.com/mastra-ai/mastra/commit/0e51c362be673502ac79626a75d1416479b0b76e), [`aa36be2`](https://github.com/mastra-ai/mastra/commit/aa36be23aa513b7dc53cb8ca16b7fab8f20e43ad), [`212c635`](https://github.com/mastra-ai/mastra/commit/212c635203e61d036ab41db8ff86c3893dc795b3), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`9aa5a73`](https://github.com/mastra-ai/mastra/commit/9aa5a73e7e110f6e9365eec69364a33d5f03bb56), [`f73c789`](https://github.com/mastra-ai/mastra/commit/f73c789e8ef21561580395d2c410119cab5848c8), [`8bd16da`](https://github.com/mastra-ai/mastra/commit/8bd16da73a4cb874d739373643dbd6a6e7f88684), [`09be9d9`](https://github.com/mastra-ai/mastra/commit/09be9d92043fc8db5b82319a729071ebfee26cca), [`c8630f8`](https://github.com/mastra-ai/mastra/commit/c8630f80d4f40cb5d22e60ab162b618b1907167a), [`8cdde58`](https://github.com/mastra-ai/mastra/commit/8cdde5875bbba6702d9df226f2b20232b8d75d6c), [`47f71dc`](https://github.com/mastra-ai/mastra/commit/47f71dc6fbcbd12d71e21a979e676e20a02bd77d), [`e191065`](https://github.com/mastra-ai/mastra/commit/e191065af6039cf6388e05aa2b84f6f5d69af4c9), [`50ceae2`](https://github.com/mastra-ai/mastra/commit/50ceae270878e2f8fb2b2c6c2faab09df0007c8a), [`8cdde58`](https://github.com/mastra-ai/mastra/commit/8cdde5875bbba6702d9df226f2b20232b8d75d6c), [`847ff1e`](https://github.com/mastra-ai/mastra/commit/847ff1e0d94368d94b2e173e4e0908e115568ef3), [`259d409`](https://github.com/mastra-ai/mastra/commit/259d409a514174299dbde1ff5e1121209b3ba850), [`9e16c68`](https://github.com/mastra-ai/mastra/commit/9e16c6818b6485ccb43df28aba6f3a2219d28662), [`a3372df`](https://github.com/mastra-ai/mastra/commit/a3372dfaf107461f47fb50a6f90088fa01d87567), [`cefca33`](https://github.com/mastra-ai/mastra/commit/cefca33ae666e69810c935fedf95a929c173d1d7), [`d00e8c5`](https://github.com/mastra-ai/mastra/commit/d00e8c50daebe5bce5bf2f48bde39c86fc3d2fe4), [`36fa7e2`](https://github.com/mastra-ai/mastra/commit/36fa7e24d14e58a1eb46147097b32f583e5b8775), [`87e9774`](https://github.com/mastra-ai/mastra/commit/87e97741c1e493cd6d62f478eb810b49bda4d57c), [`65a72e7`](https://github.com/mastra-ai/mastra/commit/65a72e70c25eedea8ff985a6624b96be2850236b), [`0f77241`](https://github.com/mastra-ai/mastra/commit/0f7724108806703799a8ba80ad0f09414afd5066), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`92ff509`](https://github.com/mastra-ai/mastra/commit/92ff5098ef8a990438ca038077021a5f7541ec1d), [`3fce5e7`](https://github.com/mastra-ai/mastra/commit/3fce5e70d011d289043e75003ef3336ed4aa43c3), [`a763592`](https://github.com/mastra-ai/mastra/commit/a763592c3db46963ef1011cfe16fe372816e775e), [`80c7737`](https://github.com/mastra-ai/mastra/commit/80c7737e32d7917b5f356957d67c169d01744fd3), [`9f9a8dc`](https://github.com/mastra-ai/mastra/commit/9f9a8dc97684a0a9879390faf4525f3225ef8453), [`ab3b611`](https://github.com/mastra-ai/mastra/commit/ab3b611d086c07d7e0c9ece270b51fc17b9f54b8), [`3f1cf47`](https://github.com/mastra-ai/mastra/commit/3f1cf476f74c1e4cc2df908837e05853a5347e31), [`ff9d743`](https://github.com/mastra-ai/mastra/commit/ff9d743f71d7e072927725c0d700632aca0c1fee)]:
  - @mastra/schema-compat@1.2.11-alpha.0
  - @mastra/core@1.38.0-alpha.3
  - @mastra/mcp@1.9.0-alpha.0
  - @mastra/observability@1.14.1-alpha.0
  - @mastra/fastembed@1.1.2-alpha.0
  - @mastra/libsql@1.12.0-alpha.0
  - @mastra/memory@1.20.1-alpha.1
  - @mastra/agent-browser@0.3.0-alpha.0
  - @mastra/pg@1.12.0-alpha.0

## 0.21.2-alpha.2

### Patch Changes

- Updated dependencies [[`d779de3`](https://github.com/mastra-ai/mastra/commit/d779de3cd9d2e7ed8110547190e2f15e786a0e41), [`1750c97`](https://github.com/mastra-ai/mastra/commit/1750c975d6179fbf6db2813b15229d4f8f23fc55), [`0e32507`](https://github.com/mastra-ai/mastra/commit/0e32507962cdfa5569b7bda5bc6fb3dd34e40b03), [`3a081c1`](https://github.com/mastra-ai/mastra/commit/3a081c1255c5ae8c99f6dad91cc612934ef6f2bd), [`fe9eacd`](https://github.com/mastra-ai/mastra/commit/fe9eacd9545a0a9d64aad31c9fa90294a425289e), [`f79df90`](https://github.com/mastra-ai/mastra/commit/f79df90e922c7985677c07d49d8fcf3afd2080c2), [`db79c86`](https://github.com/mastra-ai/mastra/commit/db79c86c60723d57e02f9636ca2611bd4515f194)]:
  - @mastra/core@1.38.0-alpha.2
  - @mastra/memory@1.20.1-alpha.0

## 0.21.2-alpha.1

### Patch Changes

- Updated dependencies [[`49f8abc`](https://github.com/mastra-ai/mastra/commit/49f8abce8258e4f2f87bd326acfbdb641264a47c)]:
  - @mastra/core@1.37.2-alpha.1

## 0.21.2-alpha.0

### Patch Changes

- Updated dependencies [[`07c3de7`](https://github.com/mastra-ai/mastra/commit/07c3de7f7bc418beccaea3b5e6b7f7cdda79d492)]:
  - @mastra/core@1.37.2-alpha.0

## 0.21.1

### Patch Changes

- Updated dependencies [[`21db1a4`](https://github.com/mastra-ai/mastra/commit/21db1a4b8ac058d5a4fbe38b516cc1b81e526915)]:
  - @mastra/core@1.37.1

## 0.21.0

### Minor Changes

- Added support for overriding Mastra Code's config directory so embedded and programmatic setups can store project configs outside the default `.mastracode` path. ([#13751](https://github.com/mastra-ai/mastra/pull/13751))

### Patch Changes

- Mastra Code's `ask_user` interactive picker now wraps long option labels across multiple rows with a `↳` continuation marker, instead of truncating them at the box edge. Arrow keys still navigate item-to-item (not row-to-row), so picking remains predictable when options span multiple lines. ([#17054](https://github.com/mastra-ai/mastra/pull/17054))

- Fixed custom slash commands so unresolved @ references remain literal instead of rendering read errors. ([#17032](https://github.com/mastra-ai/mastra/pull/17032))

- Fixed Mastra Code type checking to avoid out-of-memory failures. ([#17070](https://github.com/mastra-ai/mastra/pull/17070))

- Fixed slash commands so they run immediately while the agent is active instead of being queued, while message-sending slash commands still show pending UI until accepted. ([#16790](https://github.com/mastra-ai/mastra/pull/16790))

  Improved Ctrl+F follow-up queueing for slash commands and replaced synchronous git branch detection with an async version to reduce event loop blocking during streaming.

- **Fixed tool approval and other in-app keyboard shortcuts in modern terminals.** ([#17071](https://github.com/mastra-ai/mastra/pull/17071))

  In iTerm2, Ghostty, WezTerm, kitty and similar terminals, pressing `y` / `n` / `a` / `Y` on the tool approval dialog did nothing. The same was true for the `r` key on `/mcp` (reload servers), the `c` key on `/threads` (clone thread), and the space / enter shortcut on multi-step progress collapse.

  The root cause was the Kitty keyboard protocol that pi-tui enables on supported terminals: printable keys arrive as CSI-u escape sequences (`\x1b[121u` for `y`) instead of raw bytes, so direct character comparisons silently dropped every press. Apple Terminal.app wasn't affected because it doesn't advertise the protocol.

  All four surfaces now decode their shortcut keys through pi-tui's keyboard helpers so the same press works regardless of which keyboard protocol the terminal negotiates. `Shift+y` correctly maps to the uppercase `Y` YOLO shortcut; `Ctrl+Y` and `Alt+Y` no longer alias `Y`.

- Replaced the update notification modal with an inline component so it renders in the conversation flow and is scrollable on any terminal size. Changelog entries now display their full text instead of being truncated, with natural word-wrapping inside the bordered box. ([#16920](https://github.com/mastra-ai/mastra/pull/16920))

- Added signal delivery option attributes API that conditionally merges branch `attributes` based on whether a signal is delivered to an active agent run (`ifActive.attributes`) or an idle run (`ifIdle.attributes`). This enables contextual signal delivery — for example, tagging user messages as `while-active` when the agent is actively working. ([#16923](https://github.com/mastra-ai/mastra/pull/16923))

- Fixed MastraCode observer attachment mode persistence so Auto/On/Off choices are applied consistently across thread reloads. ([#16922](https://github.com/mastra-ai/mastra/pull/16922))

- Fixed mode switching delay — Shift+Tab now updates instantly. Fixed modal lag when opening /om and /models. Fixed duplicate messages appearing when queueing with Ctrl+F. Blocked mode switching while agent is active. ([#17008](https://github.com/mastra-ai/mastra/pull/17008))

- Improved responsiveness during streaming: reduced animation and text input lag by eliminating remaining event-loop blockers. Dynamic instruction building now uses async git branch detection and parallel binary resolution, and AGENTS.md reminders render compact loaded path notices without reading instruction files during streaming. ([#16951](https://github.com/mastra-ai/mastra/pull/16951))

- Fix Mastra Code TUI crash when ask_user option labels are wider than the terminal — long labels now wrap inside the bordered box, matching how question text already wraps. Reported in #17002. ([#17005](https://github.com/mastra-ai/mastra/pull/17005))

- Route Unix socket signal PubSub traffic through per-thread socket paths under `/tmp/mc/<resourceId>/<threadId>.sock` and guard concurrent socket initialization. ([#16939](https://github.com/mastra-ai/mastra/pull/16939))

- Suppressed noisy gateway fetch errors when models.dev is unreachable. The registry no longer retries or logs errors on network failure since all model data is already bundled at publish time. ([#16984](https://github.com/mastra-ai/mastra/pull/16984))

- Updated dependencies [[`cfa2e3a`](https://github.com/mastra-ai/mastra/commit/cfa2e3a5292322f48bb28b4d257d631da7f9d3cc), [`0cbece9`](https://github.com/mastra-ai/mastra/commit/0cbece9d832cb134a74cdbf3682d390a058215a4), [`008baaf`](https://github.com/mastra-ai/mastra/commit/008baafd8d851f831407045aebead5a2e3342eff), [`2f5f58a`](https://github.com/mastra-ai/mastra/commit/2f5f58a9a8bb13bcdc6789db221eef7c9bf1ff02), [`2f5f58a`](https://github.com/mastra-ai/mastra/commit/2f5f58a9a8bb13bcdc6789db221eef7c9bf1ff02), [`7dfe1bc`](https://github.com/mastra-ai/mastra/commit/7dfe1bcfe71d261a6fd6bbf29b1dec49d78fb98f), [`ac442a4`](https://github.com/mastra-ai/mastra/commit/ac442a42fda0354ac2bcea772bf6691cb3e9dbb3), [`b7286f4`](https://github.com/mastra-ai/mastra/commit/b7286f4308267f5fd70e6bfee10dba9472640906), [`9d2c663`](https://github.com/mastra-ai/mastra/commit/9d2c663b88f5b12bc3fea1c97f40b4eeb3665df1), [`6096445`](https://github.com/mastra-ai/mastra/commit/60964459733f0ab384584d95e19c36607ffdf7b0), [`d72dc4b`](https://github.com/mastra-ai/mastra/commit/d72dc4b12d832546c05c20255fa96fe4eb515900), [`a481027`](https://github.com/mastra-ai/mastra/commit/a481027b549ba1018414990c8f045eaee7b9f413), [`1e5c067`](https://github.com/mastra-ai/mastra/commit/1e5c067d2e20a781af670578180d1ee249806d41), [`168fa09`](https://github.com/mastra-ai/mastra/commit/168fa09d6b39114cb8c13bd06f1dccb9bc81c6cd), [`df1947a`](https://github.com/mastra-ai/mastra/commit/df1947affa40f742067542251fac7ca759492ef4), [`ee59b74`](https://github.com/mastra-ai/mastra/commit/ee59b743ce73ad11784b4d9c6fbba8568edee1c8), [`a97b1a0`](https://github.com/mastra-ai/mastra/commit/a97b1a0abaed83946c3519d1e0f680d0815b8a67), [`008baaf`](https://github.com/mastra-ai/mastra/commit/008baafd8d851f831407045aebead5a2e3342eff), [`801baa0`](https://github.com/mastra-ai/mastra/commit/801baa07cccdbaec1d00942a92bdc831111744a2), [`8116436`](https://github.com/mastra-ai/mastra/commit/81164363eb225d774e41ff27da6a5ea611406688), [`c35b962`](https://github.com/mastra-ai/mastra/commit/c35b9625c7e854fcfdeee226a3338a750d0ff211), [`c27c4b9`](https://github.com/mastra-ai/mastra/commit/c27c4b9f137df5414fca4e45896aceccff6b0ed5), [`08b3b59`](https://github.com/mastra-ai/mastra/commit/08b3b590dd960dee6c9a6e39272f8927d803db6e), [`b3c3b18`](https://github.com/mastra-ai/mastra/commit/b3c3b189121489a3a51a8fd8204b569be9a89fe5), [`4084113`](https://github.com/mastra-ai/mastra/commit/408411370fc48a822e8b616b3b63f9409774e0e9), [`70cb714`](https://github.com/mastra-ai/mastra/commit/70cb7149c8f16f478e15b58498254a53181750a4), [`91cf0e0`](https://github.com/mastra-ai/mastra/commit/91cf0e027e511b871481a8576b56b7af83b15afd), [`c86f70d`](https://github.com/mastra-ai/mastra/commit/c86f70d11170c71701daf7b49366cd04d3a3f108), [`7f9da22`](https://github.com/mastra-ai/mastra/commit/7f9da22efd5aa595e138a31de55a5f0f2f28b33d)]:
  - @mastra/core@1.37.0
  - @mastra/memory@1.20.0
  - @mastra/observability@1.14.0
  - @mastra/fastembed@1.1.1
  - @mastra/mcp@1.8.1

## 0.21.0-alpha.10

### Patch Changes

- Updated dependencies [[`d72dc4b`](https://github.com/mastra-ai/mastra/commit/d72dc4b12d832546c05c20255fa96fe4eb515900)]:
  - @mastra/core@1.37.0-alpha.9

## 0.21.0-alpha.9

### Patch Changes

- **Fixed tool approval and other in-app keyboard shortcuts in modern terminals.** ([#17071](https://github.com/mastra-ai/mastra/pull/17071))

  In iTerm2, Ghostty, WezTerm, kitty and similar terminals, pressing `y` / `n` / `a` / `Y` on the tool approval dialog did nothing. The same was true for the `r` key on `/mcp` (reload servers), the `c` key on `/threads` (clone thread), and the space / enter shortcut on multi-step progress collapse.

  The root cause was the Kitty keyboard protocol that pi-tui enables on supported terminals: printable keys arrive as CSI-u escape sequences (`\x1b[121u` for `y`) instead of raw bytes, so direct character comparisons silently dropped every press. Apple Terminal.app wasn't affected because it doesn't advertise the protocol.

  All four surfaces now decode their shortcut keys through pi-tui's keyboard helpers so the same press works regardless of which keyboard protocol the terminal negotiates. `Shift+y` correctly maps to the uppercase `Y` YOLO shortcut; `Ctrl+Y` and `Alt+Y` no longer alias `Y`.

## 0.21.0-alpha.8

### Patch Changes

- Mastra Code's `ask_user` interactive picker now wraps long option labels across multiple rows with a `↳` continuation marker, instead of truncating them at the box edge. Arrow keys still navigate item-to-item (not row-to-row), so picking remains predictable when options span multiple lines. ([#17054](https://github.com/mastra-ai/mastra/pull/17054))

- Fixed Mastra Code type checking to avoid out-of-memory failures. ([#17070](https://github.com/mastra-ai/mastra/pull/17070))

- Updated dependencies [[`9d2c663`](https://github.com/mastra-ai/mastra/commit/9d2c663b88f5b12bc3fea1c97f40b4eeb3665df1), [`c35b962`](https://github.com/mastra-ai/mastra/commit/c35b9625c7e854fcfdeee226a3338a750d0ff211), [`4084113`](https://github.com/mastra-ai/mastra/commit/408411370fc48a822e8b616b3b63f9409774e0e9)]:
  - @mastra/fastembed@1.1.1-alpha.0
  - @mastra/mcp@1.8.1-alpha.0
  - @mastra/memory@1.20.0-alpha.2
  - @mastra/core@1.37.0-alpha.8

## 0.21.0-alpha.7

### Patch Changes

- Updated dependencies [[`168fa09`](https://github.com/mastra-ai/mastra/commit/168fa09d6b39114cb8c13bd06f1dccb9bc81c6cd)]:
  - @mastra/core@1.37.0-alpha.7

## 0.21.0-alpha.6

### Minor Changes

- Added support for overriding Mastra Code's config directory so embedded and programmatic setups can store project configs outside the default `.mastracode` path. ([#13751](https://github.com/mastra-ai/mastra/pull/13751))

### Patch Changes

- Fixed custom slash commands so unresolved @ references remain literal instead of rendering read errors. ([#17032](https://github.com/mastra-ai/mastra/pull/17032))

- Suppressed noisy gateway fetch errors when models.dev is unreachable. The registry no longer retries or logs errors on network failure since all model data is already bundled at publish time. ([#16984](https://github.com/mastra-ai/mastra/pull/16984))

- Updated dependencies [[`0cbece9`](https://github.com/mastra-ai/mastra/commit/0cbece9d832cb134a74cdbf3682d390a058215a4), [`7dfe1bc`](https://github.com/mastra-ai/mastra/commit/7dfe1bcfe71d261a6fd6bbf29b1dec49d78fb98f), [`70cb714`](https://github.com/mastra-ai/mastra/commit/70cb7149c8f16f478e15b58498254a53181750a4), [`c86f70d`](https://github.com/mastra-ai/mastra/commit/c86f70d11170c71701daf7b49366cd04d3a3f108), [`7f9da22`](https://github.com/mastra-ai/mastra/commit/7f9da22efd5aa595e138a31de55a5f0f2f28b33d)]:
  - @mastra/core@1.37.0-alpha.6
  - @mastra/observability@1.14.0-alpha.1

## 0.20.1-alpha.5

### Patch Changes

- Fixed mode switching delay — Shift+Tab now updates instantly. Fixed modal lag when opening /om and /models. Fixed duplicate messages appearing when queueing with Ctrl+F. Blocked mode switching while agent is active. ([#17008](https://github.com/mastra-ai/mastra/pull/17008))

- Fix Mastra Code TUI crash when ask_user option labels are wider than the terminal — long labels now wrap inside the bordered box, matching how question text already wraps. Reported in #17002. ([#17005](https://github.com/mastra-ai/mastra/pull/17005))

- Updated dependencies [[`6096445`](https://github.com/mastra-ai/mastra/commit/60964459733f0ab384584d95e19c36607ffdf7b0), [`91cf0e0`](https://github.com/mastra-ai/mastra/commit/91cf0e027e511b871481a8576b56b7af83b15afd)]:
  - @mastra/core@1.37.0-alpha.5

## 0.20.1-alpha.4

### Patch Changes

- Updated dependencies [[`b7286f4`](https://github.com/mastra-ai/mastra/commit/b7286f4308267f5fd70e6bfee10dba9472640906), [`a481027`](https://github.com/mastra-ai/mastra/commit/a481027b549ba1018414990c8f045eaee7b9f413), [`801baa0`](https://github.com/mastra-ai/mastra/commit/801baa07cccdbaec1d00942a92bdc831111744a2), [`b3c3b18`](https://github.com/mastra-ai/mastra/commit/b3c3b189121489a3a51a8fd8204b569be9a89fe5)]:
  - @mastra/core@1.37.0-alpha.4

## 0.20.1-alpha.3

### Patch Changes

- Fixed MastraCode observer attachment mode persistence so Auto/On/Off choices are applied consistently across thread reloads. ([#16922](https://github.com/mastra-ai/mastra/pull/16922))

- Improved responsiveness during streaming: reduced animation and text input lag by eliminating remaining event-loop blockers. Dynamic instruction building now uses async git branch detection and parallel binary resolution, and AGENTS.md reminders render compact loaded path notices without reading instruction files during streaming. ([#16951](https://github.com/mastra-ai/mastra/pull/16951))

- Route Unix socket signal PubSub traffic through per-thread socket paths under `/tmp/mc/<resourceId>/<threadId>.sock` and guard concurrent socket initialization. ([#16939](https://github.com/mastra-ai/mastra/pull/16939))

- Updated dependencies [[`008baaf`](https://github.com/mastra-ai/mastra/commit/008baafd8d851f831407045aebead5a2e3342eff), [`ac442a4`](https://github.com/mastra-ai/mastra/commit/ac442a42fda0354ac2bcea772bf6691cb3e9dbb3), [`1e5c067`](https://github.com/mastra-ai/mastra/commit/1e5c067d2e20a781af670578180d1ee249806d41), [`008baaf`](https://github.com/mastra-ai/mastra/commit/008baafd8d851f831407045aebead5a2e3342eff), [`8116436`](https://github.com/mastra-ai/mastra/commit/81164363eb225d774e41ff27da6a5ea611406688), [`c27c4b9`](https://github.com/mastra-ai/mastra/commit/c27c4b9f137df5414fca4e45896aceccff6b0ed5), [`08b3b59`](https://github.com/mastra-ai/mastra/commit/08b3b590dd960dee6c9a6e39272f8927d803db6e)]:
  - @mastra/memory@1.20.0-alpha.1
  - @mastra/core@1.37.0-alpha.3

## 0.20.1-alpha.2

### Patch Changes

- Fixed slash commands so they run immediately while the agent is active instead of being queued, while message-sending slash commands still show pending UI until accepted. ([#16790](https://github.com/mastra-ai/mastra/pull/16790))

  Improved Ctrl+F follow-up queueing for slash commands and replaced synchronous git branch detection with an async version to reduce event loop blocking during streaming.

- Replaced the update notification modal with an inline component so it renders in the conversation flow and is scrollable on any terminal size. Changelog entries now display their full text instead of being truncated, with natural word-wrapping inside the bordered box. ([#16920](https://github.com/mastra-ai/mastra/pull/16920))

- Added signal delivery option attributes API that conditionally merges branch `attributes` based on whether a signal is delivered to an active agent run (`ifActive.attributes`) or an idle run (`ifIdle.attributes`). This enables contextual signal delivery — for example, tagging user messages as `while-active` when the agent is actively working. ([#16923](https://github.com/mastra-ai/mastra/pull/16923))

- Updated dependencies [[`df1947a`](https://github.com/mastra-ai/mastra/commit/df1947affa40f742067542251fac7ca759492ef4), [`ee59b74`](https://github.com/mastra-ai/mastra/commit/ee59b743ce73ad11784b4d9c6fbba8568edee1c8), [`a97b1a0`](https://github.com/mastra-ai/mastra/commit/a97b1a0abaed83946c3519d1e0f680d0815b8a67)]:
  - @mastra/core@1.37.0-alpha.2
  - @mastra/memory@1.19.1-alpha.0

## 0.20.1-alpha.1

### Patch Changes

- Updated dependencies [[`2f5f58a`](https://github.com/mastra-ai/mastra/commit/2f5f58a9a8bb13bcdc6789db221eef7c9bf1ff02), [`2f5f58a`](https://github.com/mastra-ai/mastra/commit/2f5f58a9a8bb13bcdc6789db221eef7c9bf1ff02)]:
  - @mastra/core@1.37.0-alpha.1
  - @mastra/observability@1.14.0-alpha.0

## 0.20.1-alpha.0

### Patch Changes

- Updated dependencies [[`cfa2e3a`](https://github.com/mastra-ai/mastra/commit/cfa2e3a5292322f48bb28b4d257d631da7f9d3cc)]:
  - @mastra/core@1.36.1-alpha.0

## 0.20.0

### Minor Changes

- Added automatic return to Plan mode when a goal started from an approved plan finishes. ([#16676](https://github.com/mastra-ai/mastra/pull/16676))

- Added the `/skill/<name>` command to explicitly activate an installed workspace skill in the current conversation. This complements automatic skill activation. ([#16618](https://github.com/mastra-ai/mastra/pull/16618))

  ```text
  /skill/github-triage
  /skill/release-check focus tests
  ```

  The command loads the skill's instructions (plus any `references/`, `scripts/`, and `assets/` paths the skill ships) and sends them to the agent. Use `/skills` to list available skills.

  Skills can opt out of direct user invocation by setting `user-invocable: false` in their frontmatter — those skills remain available for automatic activation by the agent but do not appear in `/skill/<name>` autocomplete, the `/skills` listing, or accept direct invocation.

  ```md title=".mastracode/skills/internal-helper/SKILL.md"
  ---
  name: internal-helper
  description: Used by the agent internally; not for direct user invocation.
  user-invocable: false
  ---
  ```

  Closes #16344.

- Added PostHog product analytics for MastraCode sessions, prompts, thread changes, command usage, and interactive prompts. Set MASTRA_TELEMETRY_DISABLED=1 to disable telemetry. ([#15173](https://github.com/mastra-ai/mastra/pull/15173))

### Patch Changes

- Fixed goal judge evaluations so they complete more reliably and retry when no structured decision is returned. Fixed `/goal resume` to retrigger judge evaluation after judge-related pauses instead of sending a normal continuation. ([#16843](https://github.com/mastra-ai/mastra/pull/16843))

- Improved quiet mode readability: use WCAG contrast-adapted 'muted' color for task counters and pending text, de-emphasize completed tasks, use visibleWidth for accurate task alignment, and adapt compact tool connector glyphs on non-black terminal backgrounds ([#16839](https://github.com/mastra-ai/mastra/pull/16839))

- Improved MastraCode rendering responsiveness during large streamed tool previews by upgrading the terminal UI renderer. ([#16835](https://github.com/mastra-ai/mastra/pull/16835))

- Add an "Observe attachments" toggle in `/om` settings that controls whether ([#16682](https://github.com/mastra-ai/mastra/pull/16682))
  file and image attachments are forwarded to the Observer LLM. Turn it off when
  running with a text-only observer model. Stored as `omObserveAttachments` in
  global settings and seeded into the harness state at startup.

- Improved MastraCode quiet mode so terminal sessions are easier to scan. ([#16771](https://github.com/mastra-ai/mastra/pull/16771))
  - Quiet mode is now the default for new installs, and existing classic users get a one-time prompt to choose whether to enable it.
  - Added compact tool previews with a configurable preview-line limit, including an option to hide previews.
  - Improved repeated tool-call rendering, path continuation handling, task wrapping, shell/error previews, and spacing between tools, messages, plans, and completed subagents.
  - Added edited line ranges to workspace edit results so tool UIs can show where replacements happened.

- Updated MastraCode to use provider-aware Observational Memory idle activation. ([#16663](https://github.com/mastra-ai/mastra/pull/16663))

  MastraCode now sets `activateAfterIdle: "auto"`, shows an idle-time counter above the input after one minute of inactivity, and combines back-to-back OM activation markers into a single line.

- Restore MastraCode local command execution to inherit parent environment variables while redacting env-shaped and secret-looking workspace trace data. ([#16691](https://github.com/mastra-ai/mastra/pull/16691))

- Fixed goal pursuit timers so they only count active work and stay paused while waiting for user input. ([#16690](https://github.com/mastra-ai/mastra/pull/16690))

- Added a Unix socket PubSub transport and wired the Mastra Code TUI through a per-resource socket so local sessions can coordinate thread streams across processes. Programmatic `createMastraCode` usage remains opt-in: ([#16669](https://github.com/mastra-ai/mastra/pull/16669))

  ```ts
  await createMastraCode({ unixSocketPubSub: true });
  ```

- Fixed terminal rendering so command output, task lists, and plan feedback input stay aligned while redrawing. ([#16849](https://github.com/mastra-ai/mastra/pull/16849))

- Improved thread signal handling in the TUI to work with the simplified signal contents shape. ([#16622](https://github.com/mastra-ai/mastra/pull/16622))

- Updated dependencies [[`452036a`](https://github.com/mastra-ai/mastra/commit/452036a0d965b4f4c1efd93606e4f03b50b807a5), [`c272d50`](https://github.com/mastra-ai/mastra/commit/c272d50610a54496b6b6d92ccd4d37b333a2613a), [`27fd1b7`](https://github.com/mastra-ai/mastra/commit/27fd1b79ac62eb7694f92587eb7d1be05b59be01), [`5ba7253`](https://github.com/mastra-ai/mastra/commit/5ba7253745c85e8df8012a76d954c640ffa336f7), [`5556cc1`](https://github.com/mastra-ai/mastra/commit/5556cc1befec71518d84f826b3bfe3a079a9daf7), [`f73980d`](https://github.com/mastra-ai/mastra/commit/f73980d651eb5f7f1ab20582de4615a1b6f10fce), [`5499303`](https://github.com/mastra-ai/mastra/commit/54993032c1ebc09642625b78d2014e0cf84a3cae), [`a702009`](https://github.com/mastra-ai/mastra/commit/a702009d3cfaa745120f501e21c783ed4d6a3072), [`46cbb7e`](https://github.com/mastra-ai/mastra/commit/46cbb7e84a0fadcf8c26ddfad38278732c22143e), [`9430352`](https://github.com/mastra-ai/mastra/commit/94303523460cb09dcd0d8139c11926029631d6ba), [`5d8003c`](https://github.com/mastra-ai/mastra/commit/5d8003c7b082e0b916458cbaf0fa274f226b0734), [`9aee493`](https://github.com/mastra-ai/mastra/commit/9aee493ed6089b5133472623dcce49934bf2d509), [`d8692af`](https://github.com/mastra-ai/mastra/commit/d8692afa253028e39cdce2aafa0ac414071a762e), [`1a9cc60`](https://github.com/mastra-ai/mastra/commit/1a9cc6069f9910fc3d59e4953ac8cd95d89ad6f5), [`8cdb86c`](https://github.com/mastra-ai/mastra/commit/8cdb86ceed1137bc2768e147dce85a0692b9fb26), [`8534d79`](https://github.com/mastra-ai/mastra/commit/8534d791fa1cb70fe1c19e2604c4b63cc10dd051), [`eda90c5`](https://github.com/mastra-ai/mastra/commit/eda90c5bfd7de11805ecc9f4552716c895fbaf78), [`a935b0a`](https://github.com/mastra-ai/mastra/commit/a935b0a0977ae3f196b33ec7621f528069c82db0), [`9c88701`](https://github.com/mastra-ai/mastra/commit/9c8870195b41a38dc40b6ba2aa55eda04df8fa69), [`7f6a053`](https://github.com/mastra-ai/mastra/commit/7f6a053b6a76f12b8ab0f25da1709adbd5134cd6), [`c78f8cd`](https://github.com/mastra-ai/mastra/commit/c78f8cd6222a86e6c60ae5210b6929ad5221b6fb), [`14b69c6`](https://github.com/mastra-ai/mastra/commit/14b69c6b05ce1e50c140b030a48cafb41d0746e3), [`e146aad`](https://github.com/mastra-ai/mastra/commit/e146aadbba66c410ba0e74bac4c50135495cb8dd), [`4bd4e8e`](https://github.com/mastra-ai/mastra/commit/4bd4e8e042f6687559f49a560a7914cee9b85447), [`ac79462`](https://github.com/mastra-ai/mastra/commit/ac79462b98f1062394c45093aa515b0766f27ee2), [`6b8a53e`](https://github.com/mastra-ai/mastra/commit/6b8a53eea3b255a4fd0b29bc0237cdd1906bf55c), [`1a0ec78`](https://github.com/mastra-ai/mastra/commit/1a0ec789a26cae443744e9abbd62ed6ee676af39), [`e47bca7`](https://github.com/mastra-ai/mastra/commit/e47bca7b72866d3abd173b9f530ac4318113a8ff), [`eda90c5`](https://github.com/mastra-ai/mastra/commit/eda90c5bfd7de11805ecc9f4552716c895fbaf78), [`afc004f`](https://github.com/mastra-ai/mastra/commit/afc004f5cc7e30697809e7021820b9f5881e6719), [`0031d0f`](https://github.com/mastra-ai/mastra/commit/0031d0f13831d7843ac5d498734a7d92862e2ce3), [`841a222`](https://github.com/mastra-ai/mastra/commit/841a222560d8c19238f8213713f30535cdd82284), [`64c1e0b`](https://github.com/mastra-ai/mastra/commit/64c1e0b35165c96b659818bd0177aa18794ef11f), [`40d83a9`](https://github.com/mastra-ai/mastra/commit/40d83a90d9be31a1b83e04649edb703eb7753e33), [`4e88dc6`](https://github.com/mastra-ai/mastra/commit/4e88dc6b89f154c0eae37221c8126be0c23c569f), [`19018f0`](https://github.com/mastra-ai/mastra/commit/19018f05722af74a5978781a7731a654b26f7f2a), [`19281c7`](https://github.com/mastra-ai/mastra/commit/19281c70424f757219782de16c2699743c5e04d0), [`3498b49`](https://github.com/mastra-ai/mastra/commit/3498b4946be94f4313cd817733589680dcda5278), [`d52b6fe`](https://github.com/mastra-ai/mastra/commit/d52b6fe1c56853eb38864baae0bbfa75cc739ccb), [`408be73`](https://github.com/mastra-ai/mastra/commit/408be73449dfab92b51eab8c6623b6c443debc25), [`359439b`](https://github.com/mastra-ai/mastra/commit/359439bb8c635e048176306828195f8297f50021), [`96d225b`](https://github.com/mastra-ai/mastra/commit/96d225b05ed52ff250e0a342a7e6398e291945f0), [`71a820b`](https://github.com/mastra-ai/mastra/commit/71a820b2353fa1406772c50760a3732058a8b337), [`3552b1c`](https://github.com/mastra-ai/mastra/commit/3552b1c872988885f1c33d97122323567e2aff8e), [`1698f5e`](https://github.com/mastra-ai/mastra/commit/1698f5ec141d34f22a873efdb145ce3cdf848a5e)]:
  - @mastra/core@1.36.0
  - @mastra/memory@1.19.0
  - @mastra/mcp@1.8.0
  - @mastra/duckdb@1.4.0
  - @mastra/stagehand@0.2.3
  - @mastra/observability@1.13.0
  - @mastra/libsql@1.11.1
  - @mastra/pg@1.11.1
  - @mastra/fastembed@1.1.0

## 0.20.0-alpha.12

### Patch Changes

- Fixed goal judge evaluations so they complete more reliably and retry when no structured decision is returned. Fixed `/goal resume` to retrigger judge evaluation after judge-related pauses instead of sending a normal continuation. ([#16843](https://github.com/mastra-ai/mastra/pull/16843))

- Improved quiet mode readability: use WCAG contrast-adapted 'muted' color for task counters and pending text, de-emphasize completed tasks, use visibleWidth for accurate task alignment, and adapt compact tool connector glyphs on non-black terminal backgrounds ([#16839](https://github.com/mastra-ai/mastra/pull/16839))

- Fixed terminal rendering so command output, task lists, and plan feedback input stay aligned while redrawing. ([#16849](https://github.com/mastra-ai/mastra/pull/16849))

- Updated dependencies [[`27fd1b7`](https://github.com/mastra-ai/mastra/commit/27fd1b79ac62eb7694f92587eb7d1be05b59be01), [`a702009`](https://github.com/mastra-ai/mastra/commit/a702009d3cfaa745120f501e21c783ed4d6a3072), [`46cbb7e`](https://github.com/mastra-ai/mastra/commit/46cbb7e84a0fadcf8c26ddfad38278732c22143e), [`8534d79`](https://github.com/mastra-ai/mastra/commit/8534d791fa1cb70fe1c19e2604c4b63cc10dd051), [`c78f8cd`](https://github.com/mastra-ai/mastra/commit/c78f8cd6222a86e6c60ae5210b6929ad5221b6fb), [`e146aad`](https://github.com/mastra-ai/mastra/commit/e146aadbba66c410ba0e74bac4c50135495cb8dd), [`1a0ec78`](https://github.com/mastra-ai/mastra/commit/1a0ec789a26cae443744e9abbd62ed6ee676af39), [`d52b6fe`](https://github.com/mastra-ai/mastra/commit/d52b6fe1c56853eb38864baae0bbfa75cc739ccb)]:
  - @mastra/core@1.36.0-alpha.10
  - @mastra/mcp@1.8.0-alpha.2
  - @mastra/libsql@1.11.1-alpha.0
  - @mastra/pg@1.11.1-alpha.0

## 0.20.0-alpha.11

### Patch Changes

- Improved MastraCode rendering responsiveness during large streamed tool previews by upgrading the terminal UI renderer. ([#16835](https://github.com/mastra-ai/mastra/pull/16835))

- Updated dependencies [[`1698f5e`](https://github.com/mastra-ai/mastra/commit/1698f5ec141d34f22a873efdb145ce3cdf848a5e)]:
  - @mastra/core@1.36.0-alpha.9

## 0.20.0-alpha.10

### Patch Changes

- Updated dependencies [[`5d8003c`](https://github.com/mastra-ai/mastra/commit/5d8003c7b082e0b916458cbaf0fa274f226b0734), [`9aee493`](https://github.com/mastra-ai/mastra/commit/9aee493ed6089b5133472623dcce49934bf2d509)]:
  - @mastra/duckdb@1.4.0-alpha.1
  - @mastra/core@1.36.0-alpha.8

## 0.20.0-alpha.9

### Patch Changes

- Updated dependencies [[`a935b0a`](https://github.com/mastra-ai/mastra/commit/a935b0a0977ae3f196b33ec7621f528069c82db0)]:
  - @mastra/core@1.36.0-alpha.7

## 0.20.0-alpha.8

### Patch Changes

- Added a Unix socket PubSub transport and wired the Mastra Code TUI through a per-resource socket so local sessions can coordinate thread streams across processes. Programmatic `createMastraCode` usage remains opt-in: ([#16669](https://github.com/mastra-ai/mastra/pull/16669))

  ```ts
  await createMastraCode({ unixSocketPubSub: true });
  ```

- Updated dependencies [[`71a820b`](https://github.com/mastra-ai/mastra/commit/71a820b2353fa1406772c50760a3732058a8b337)]:
  - @mastra/core@1.36.0-alpha.6

## 0.20.0-alpha.7

### Minor Changes

- Added PostHog product analytics for MastraCode sessions, prompts, thread changes, command usage, and interactive prompts. Set MASTRA_TELEMETRY_DISABLED=1 to disable telemetry. ([#15173](https://github.com/mastra-ai/mastra/pull/15173))

### Patch Changes

- Improved MastraCode quiet mode so terminal sessions are easier to scan. ([#16771](https://github.com/mastra-ai/mastra/pull/16771))
  - Quiet mode is now the default for new installs, and existing classic users get a one-time prompt to choose whether to enable it.
  - Added compact tool previews with a configurable preview-line limit, including an option to hide previews.
  - Improved repeated tool-call rendering, path continuation handling, task wrapping, shell/error previews, and spacing between tools, messages, plans, and completed subagents.
  - Added edited line ranges to workspace edit results so tool UIs can show where replacements happened.

- Updated dependencies [[`ac79462`](https://github.com/mastra-ai/mastra/commit/ac79462b98f1062394c45093aa515b0766f27ee2), [`19281c7`](https://github.com/mastra-ai/mastra/commit/19281c70424f757219782de16c2699743c5e04d0)]:
  - @mastra/core@1.36.0-alpha.5

## 0.20.0-alpha.6

### Minor Changes

- Added automatic return to Plan mode when a goal started from an approved plan finishes. ([#16676](https://github.com/mastra-ai/mastra/pull/16676))

### Patch Changes

- Add an "Observe attachments" toggle in `/om` settings that controls whether ([#16682](https://github.com/mastra-ai/mastra/pull/16682))
  file and image attachments are forwarded to the Observer LLM. Turn it off when
  running with a text-only observer model. Stored as `omObserveAttachments` in
  global settings and seeded into the harness state at startup.

- Updated MastraCode to use provider-aware Observational Memory idle activation. ([#16663](https://github.com/mastra-ai/mastra/pull/16663))

  MastraCode now sets `activateAfterIdle: "auto"`, shows an idle-time counter above the input after one minute of inactivity, and combines back-to-back OM activation markers into a single line.

- Updated dependencies [[`c272d50`](https://github.com/mastra-ai/mastra/commit/c272d50610a54496b6b6d92ccd4d37b333a2613a), [`d8692af`](https://github.com/mastra-ai/mastra/commit/d8692afa253028e39cdce2aafa0ac414071a762e), [`14b69c6`](https://github.com/mastra-ai/mastra/commit/14b69c6b05ce1e50c140b030a48cafb41d0746e3), [`4bd4e8e`](https://github.com/mastra-ai/mastra/commit/4bd4e8e042f6687559f49a560a7914cee9b85447), [`841a222`](https://github.com/mastra-ai/mastra/commit/841a222560d8c19238f8213713f30535cdd82284), [`96d225b`](https://github.com/mastra-ai/mastra/commit/96d225b05ed52ff250e0a342a7e6398e291945f0)]:
  - @mastra/core@1.36.0-alpha.4
  - @mastra/memory@1.19.0-alpha.1
  - @mastra/mcp@1.8.0-alpha.1
  - @mastra/fastembed@1.1.0-alpha.0

## 0.20.0-alpha.5

### Patch Changes

- Restore MastraCode local command execution to inherit parent environment variables while redacting env-shaped and secret-looking workspace trace data. ([#16691](https://github.com/mastra-ai/mastra/pull/16691))

- Fixed goal pursuit timers so they only count active work and stay paused while waiting for user input. ([#16690](https://github.com/mastra-ai/mastra/pull/16690))

- Updated dependencies [[`5556cc1`](https://github.com/mastra-ai/mastra/commit/5556cc1befec71518d84f826b3bfe3a079a9daf7), [`5499303`](https://github.com/mastra-ai/mastra/commit/54993032c1ebc09642625b78d2014e0cf84a3cae), [`e47bca7`](https://github.com/mastra-ai/mastra/commit/e47bca7b72866d3abd173b9f530ac4318113a8ff), [`0031d0f`](https://github.com/mastra-ai/mastra/commit/0031d0f13831d7843ac5d498734a7d92862e2ce3), [`3498b49`](https://github.com/mastra-ai/mastra/commit/3498b4946be94f4313cd817733589680dcda5278), [`359439b`](https://github.com/mastra-ai/mastra/commit/359439bb8c635e048176306828195f8297f50021), [`3552b1c`](https://github.com/mastra-ai/mastra/commit/3552b1c872988885f1c33d97122323567e2aff8e)]:
  - @mastra/core@1.36.0-alpha.3
  - @mastra/duckdb@1.4.0-alpha.0
  - @mastra/observability@1.13.0-alpha.1

## 0.20.0-alpha.4

### Patch Changes

- Updated dependencies [[`5ba7253`](https://github.com/mastra-ai/mastra/commit/5ba7253745c85e8df8012a76d954c640ffa336f7), [`f73980d`](https://github.com/mastra-ai/mastra/commit/f73980d651eb5f7f1ab20582de4615a1b6f10fce), [`9c88701`](https://github.com/mastra-ai/mastra/commit/9c8870195b41a38dc40b6ba2aa55eda04df8fa69), [`4e88dc6`](https://github.com/mastra-ai/mastra/commit/4e88dc6b89f154c0eae37221c8126be0c23c569f), [`19018f0`](https://github.com/mastra-ai/mastra/commit/19018f05722af74a5978781a7731a654b26f7f2a)]:
  - @mastra/core@1.36.0-alpha.2

## 0.20.0-alpha.3

### Patch Changes

- Updated dependencies [[`8cdb86c`](https://github.com/mastra-ai/mastra/commit/8cdb86ceed1137bc2768e147dce85a0692b9fb26), [`eda90c5`](https://github.com/mastra-ai/mastra/commit/eda90c5bfd7de11805ecc9f4552716c895fbaf78), [`eda90c5`](https://github.com/mastra-ai/mastra/commit/eda90c5bfd7de11805ecc9f4552716c895fbaf78), [`afc004f`](https://github.com/mastra-ai/mastra/commit/afc004f5cc7e30697809e7021820b9f5881e6719), [`408be73`](https://github.com/mastra-ai/mastra/commit/408be73449dfab92b51eab8c6623b6c443debc25)]:
  - @mastra/core@1.36.0-alpha.1
  - @mastra/observability@1.13.0-alpha.0

## 0.20.0-alpha.2

### Patch Changes

- Updated dependencies [[`9430352`](https://github.com/mastra-ai/mastra/commit/94303523460cb09dcd0d8139c11926029631d6ba), [`7f6a053`](https://github.com/mastra-ai/mastra/commit/7f6a053b6a76f12b8ab0f25da1709adbd5134cd6)]:
  - @mastra/mcp@1.7.1-alpha.0
  - @mastra/memory@1.18.3-alpha.0

## 0.20.0-alpha.1

### Patch Changes

- Updated dependencies [[`6b8a53e`](https://github.com/mastra-ai/mastra/commit/6b8a53eea3b255a4fd0b29bc0237cdd1906bf55c)]:
  - @mastra/stagehand@0.2.3-alpha.0

## 0.20.0-alpha.0

### Minor Changes

- Added the `/skill/<name>` command to explicitly activate an installed workspace skill in the current conversation. This complements automatic skill activation. ([#16618](https://github.com/mastra-ai/mastra/pull/16618))

  ```text
  /skill/github-triage
  /skill/release-check focus tests
  ```

  The command loads the skill's instructions (plus any `references/`, `scripts/`, and `assets/` paths the skill ships) and sends them to the agent. Use `/skills` to list available skills.

  Skills can opt out of direct user invocation by setting `user-invocable: false` in their frontmatter — those skills remain available for automatic activation by the agent but do not appear in `/skill/<name>` autocomplete, the `/skills` listing, or accept direct invocation.

  ```md title=".mastracode/skills/internal-helper/SKILL.md"
  ---
  name: internal-helper
  description: Used by the agent internally; not for direct user invocation.
  user-invocable: false
  ---
  ```

  Closes #16344.

### Patch Changes

- Improved thread signal handling in the TUI to work with the simplified signal contents shape. ([#16622](https://github.com/mastra-ai/mastra/pull/16622))

- Updated dependencies [[`452036a`](https://github.com/mastra-ai/mastra/commit/452036a0d965b4f4c1efd93606e4f03b50b807a5), [`1a9cc60`](https://github.com/mastra-ai/mastra/commit/1a9cc6069f9910fc3d59e4953ac8cd95d89ad6f5), [`64c1e0b`](https://github.com/mastra-ai/mastra/commit/64c1e0b35165c96b659818bd0177aa18794ef11f), [`40d83a9`](https://github.com/mastra-ai/mastra/commit/40d83a90d9be31a1b83e04649edb703eb7753e33)]:
  - @mastra/core@1.36.0-alpha.0

## 0.19.1

### Patch Changes

- Improve goal mode UX: ([#16654](https://github.com/mastra-ai/mastra/pull/16654))
  - Add `/goal` actions and built-in subcommand autocomplete.
  - Add goal-aware planning guidance so submitted plans can be used as executable goals.
  - Let the judge evaluate full assistant responses and verify work with readonly workspace tools.
  - Stream muted judge activity into the goal box and support Ctrl+C judge aborts.
  - Show duration-based goal status and clearer plan approval rendering with streamed plan previews.

- Updated dependencies [[`b661349`](https://github.com/mastra-ai/mastra/commit/b661349281514691db78941a9044e6e4f1cde7a7), [`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`271c044`](https://github.com/mastra-ai/mastra/commit/271c044f6b79ff38cfa3409f4385fbd26a0f3185), [`1be0793`](https://github.com/mastra-ai/mastra/commit/1be079325f05cdec100cc6967572576dfc9e2e44), [`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`bad08e9`](https://github.com/mastra-ai/mastra/commit/bad08e99c5291884c3ac76743c78c74f53a302c2), [`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`b32ba5f`](https://github.com/mastra-ai/mastra/commit/b32ba5fde524b46a4ff1bdf38e30d62a2bb29b04), [`75c7c38`](https://github.com/mastra-ai/mastra/commit/75c7c38a4e9af9821931539dd339f57fcc6414e3), [`3d42730`](https://github.com/mastra-ai/mastra/commit/3d42730bed209f3ea4088be10013df6fa91fe757)]:
  - @mastra/core@1.35.0
  - @mastra/libsql@1.11.0
  - @mastra/pg@1.11.0
  - @mastra/memory@1.18.2

## 0.19.1-alpha.3

### Patch Changes

- Improve goal mode UX: ([#16654](https://github.com/mastra-ai/mastra/pull/16654))
  - Add `/goal` actions and built-in subcommand autocomplete.
  - Add goal-aware planning guidance so submitted plans can be used as executable goals.
  - Let the judge evaluate full assistant responses and verify work with readonly workspace tools.
  - Stream muted judge activity into the goal box and support Ctrl+C judge aborts.
  - Show duration-based goal status and clearer plan approval rendering with streamed plan previews.

- Updated dependencies [[`271c044`](https://github.com/mastra-ai/mastra/commit/271c044f6b79ff38cfa3409f4385fbd26a0f3185), [`75c7c38`](https://github.com/mastra-ai/mastra/commit/75c7c38a4e9af9821931539dd339f57fcc6414e3)]:
  - @mastra/core@1.35.0-alpha.3

## 0.19.1-alpha.2

### Patch Changes

- Updated dependencies [[`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`1be0793`](https://github.com/mastra-ai/mastra/commit/1be079325f05cdec100cc6967572576dfc9e2e44), [`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`b32ba5f`](https://github.com/mastra-ai/mastra/commit/b32ba5fde524b46a4ff1bdf38e30d62a2bb29b04)]:
  - @mastra/libsql@1.11.0-alpha.0
  - @mastra/pg@1.11.0-alpha.0
  - @mastra/core@1.35.0-alpha.2
  - @mastra/memory@1.18.2-alpha.1

## 0.19.1-alpha.1

### Patch Changes

- Updated dependencies [[`bad08e9`](https://github.com/mastra-ai/mastra/commit/bad08e99c5291884c3ac76743c78c74f53a302c2), [`3d42730`](https://github.com/mastra-ai/mastra/commit/3d42730bed209f3ea4088be10013df6fa91fe757)]:
  - @mastra/core@1.35.0-alpha.1
  - @mastra/memory@1.18.2-alpha.0

## 0.19.1-alpha.0

### Patch Changes

- Updated dependencies [[`b661349`](https://github.com/mastra-ai/mastra/commit/b661349281514691db78941a9044e6e4f1cde7a7)]:
  - @mastra/core@1.34.1-alpha.0

## 0.19.0

### Minor Changes

- Improved OpenAI Codex OAuth support in Mastra Code. When you select the Codex provider in `/login` or during onboarding, Mastra Code now asks how to sign in — **Browser (local callback)** or **Device code (headless)** — so the device-code flow is discoverable without setting an env var. `MASTRACODE_OPENAI_CODEX_AUTH_MODE=device` still works as a preselect for scripted environments. ([#16548](https://github.com/mastra-ai/mastra/pull/16548))

  HTTP MCP server config can now pass OAuth client metadata to `@mastra/mcp` and store per-server OAuth state without sharing tokens across projects:

  ```json
  {
    "mcpServers": {
      "remote-api": {
        "url": "https://mcp.example.com/mcp",
        "oauth": {
          "redirectUrl": "http://localhost:3000/oauth/callback"
        }
      }
    }
  }
  ```

### Patch Changes

- Updated dependencies [[`20787de`](https://github.com/mastra-ai/mastra/commit/20787de5965234a1af28fe35f49437c537dbfa0d), [`784ad98`](https://github.com/mastra-ai/mastra/commit/784ad989549de91dc5d33ab8ef36caa6f7dcd34e), [`fceae1f`](https://github.com/mastra-ai/mastra/commit/fceae1f5f5db4722cb078a663c6eb4bd22944123), [`090a647`](https://github.com/mastra-ai/mastra/commit/090a647ba5a66d36f203f9f49457e03a1ff4e6fb), [`97fe629`](https://github.com/mastra-ai/mastra/commit/97fe629d07b0a9952e6657b1e6334ca4d9aa15ce), [`bf02acb`](https://github.com/mastra-ai/mastra/commit/bf02acbb8a6110f638ac844e89f1ebf04cb7fe74), [`090a647`](https://github.com/mastra-ai/mastra/commit/090a647ba5a66d36f203f9f49457e03a1ff4e6fb), [`bdb4cbf`](https://github.com/mastra-ai/mastra/commit/bdb4cbf8ba4b685d7481f28bb9dc3de6c79c9ed2), [`0fd3fbe`](https://github.com/mastra-ai/mastra/commit/0fd3fbe40fb63657aedd72f6e7b38c8e8ee6940d), [`f84447d`](https://github.com/mastra-ai/mastra/commit/f84447d6c80f3471836a9b300d246b331fb47e0d), [`a1a5b3e`](https://github.com/mastra-ai/mastra/commit/a1a5b3e42ab2ca5161ea21db59ebf28442680fa7), [`af84f57`](https://github.com/mastra-ai/mastra/commit/af84f571ed762e92e8e61c5f9a72363520914274), [`8b3c6f9`](https://github.com/mastra-ai/mastra/commit/8b3c6f90f7879833ba7d1bc70937e1d8f69d0804), [`fed0475`](https://github.com/mastra-ai/mastra/commit/fed0475ccfea31e4fc251469ac05640d0742c1f0), [`0d53730`](https://github.com/mastra-ai/mastra/commit/0d53730c1ed87ef80c87caa5701c4170ea8028e6), [`522f44d`](https://github.com/mastra-ai/mastra/commit/522f44d947214bfc06cff50599bae1ef3494880d)]:
  - @mastra/core@1.34.0
  - @mastra/memory@1.18.1
  - @mastra/duckdb@1.3.2

## 0.19.0-alpha.3

### Patch Changes

- Updated dependencies [[`090a647`](https://github.com/mastra-ai/mastra/commit/090a647ba5a66d36f203f9f49457e03a1ff4e6fb), [`090a647`](https://github.com/mastra-ai/mastra/commit/090a647ba5a66d36f203f9f49457e03a1ff4e6fb), [`f84447d`](https://github.com/mastra-ai/mastra/commit/f84447d6c80f3471836a9b300d246b331fb47e0d), [`a1a5b3e`](https://github.com/mastra-ai/mastra/commit/a1a5b3e42ab2ca5161ea21db59ebf28442680fa7), [`af84f57`](https://github.com/mastra-ai/mastra/commit/af84f571ed762e92e8e61c5f9a72363520914274), [`8b3c6f9`](https://github.com/mastra-ai/mastra/commit/8b3c6f90f7879833ba7d1bc70937e1d8f69d0804)]:
  - @mastra/core@1.34.0-alpha.3
  - @mastra/duckdb@1.3.2-alpha.0

## 0.19.0-alpha.2

### Patch Changes

- Updated dependencies [[`bdb4cbf`](https://github.com/mastra-ai/mastra/commit/bdb4cbf8ba4b685d7481f28bb9dc3de6c79c9ed2)]:
  - @mastra/core@1.34.0-alpha.2

## 0.19.0-alpha.1

### Patch Changes

- Updated dependencies [[`fceae1f`](https://github.com/mastra-ai/mastra/commit/fceae1f5f5db4722cb078a663c6eb4bd22944123), [`97fe629`](https://github.com/mastra-ai/mastra/commit/97fe629d07b0a9952e6657b1e6334ca4d9aa15ce), [`bf02acb`](https://github.com/mastra-ai/mastra/commit/bf02acbb8a6110f638ac844e89f1ebf04cb7fe74), [`0fd3fbe`](https://github.com/mastra-ai/mastra/commit/0fd3fbe40fb63657aedd72f6e7b38c8e8ee6940d), [`fed0475`](https://github.com/mastra-ai/mastra/commit/fed0475ccfea31e4fc251469ac05640d0742c1f0), [`522f44d`](https://github.com/mastra-ai/mastra/commit/522f44d947214bfc06cff50599bae1ef3494880d)]:
  - @mastra/core@1.34.0-alpha.1
  - @mastra/memory@1.18.1-alpha.0

## 0.19.0-alpha.0

### Minor Changes

- Improved OpenAI Codex OAuth support in Mastra Code. When you select the Codex provider in `/login` or during onboarding, Mastra Code now asks how to sign in — **Browser (local callback)** or **Device code (headless)** — so the device-code flow is discoverable without setting an env var. `MASTRACODE_OPENAI_CODEX_AUTH_MODE=device` still works as a preselect for scripted environments. ([#16548](https://github.com/mastra-ai/mastra/pull/16548))

  HTTP MCP server config can now pass OAuth client metadata to `@mastra/mcp` and store per-server OAuth state without sharing tokens across projects:

  ```json
  {
    "mcpServers": {
      "remote-api": {
        "url": "https://mcp.example.com/mcp",
        "oauth": {
          "redirectUrl": "http://localhost:3000/oauth/callback"
        }
      }
    }
  }
  ```

### Patch Changes

- Updated dependencies [[`20787de`](https://github.com/mastra-ai/mastra/commit/20787de5965234a1af28fe35f49437c537dbfa0d), [`784ad98`](https://github.com/mastra-ai/mastra/commit/784ad989549de91dc5d33ab8ef36caa6f7dcd34e), [`0d53730`](https://github.com/mastra-ai/mastra/commit/0d53730c1ed87ef80c87caa5701c4170ea8028e6)]:
  - @mastra/core@1.34.0-alpha.0

## 0.18.1

### Patch Changes

- Fixed a bug where clicking Approve on a plan from `/plan` mode would show the system reminder twice and sometimes hang instead of starting build execution. Approving now reliably triggers the build agent with a single reminder. ([#16521](https://github.com/mastra-ai/mastra/pull/16521))

- Updated dependencies [[`6ba46dc`](https://github.com/mastra-ai/mastra/commit/6ba46dc1ac04af635d0f59377d7384ca6af44cd1), [`3e63fca`](https://github.com/mastra-ai/mastra/commit/3e63fca7aa41269b2a9518effdd09b8ab8f1ff04), [`bc386e0`](https://github.com/mastra-ai/mastra/commit/bc386e08249dd30f3e66cf59de0c151a8dc26afb)]:
  - @mastra/core@1.33.1

## 0.18.1-alpha.1

### Patch Changes

- Fixed a bug where clicking Approve on a plan from `/plan` mode would show the system reminder twice and sometimes hang instead of starting build execution. Approving now reliably triggers the build agent with a single reminder. ([#16521](https://github.com/mastra-ai/mastra/pull/16521))

- Updated dependencies [[`3e63fca`](https://github.com/mastra-ai/mastra/commit/3e63fca7aa41269b2a9518effdd09b8ab8f1ff04), [`bc386e0`](https://github.com/mastra-ai/mastra/commit/bc386e08249dd30f3e66cf59de0c151a8dc26afb)]:
  - @mastra/core@1.33.1-alpha.1

## 0.18.1-alpha.0

### Patch Changes

- Updated dependencies [[`6ba46dc`](https://github.com/mastra-ai/mastra/commit/6ba46dc1ac04af635d0f59377d7384ca6af44cd1)]:
  - @mastra/core@1.33.1-alpha.0

## 0.18.0

### Minor Changes

- Added `/goal` to Mastra Code, a persistent autonomous task loop similar to the goal modes in Codex and Hermes Agent. ([#16065](https://github.com/mastra-ai/mastra/pull/16065))

  A user can start a goal with `/goal <objective>`. Mastra Code saves that objective to the current thread, runs the normal assistant turn, then asks a separate judge model whether the goal is `done`, should `continue`, or is `waiting` on an explicit user checkpoint. When the judge says to continue, Mastra Code feeds the judge feedback back into the conversation and keeps working until the goal is complete, paused, cleared, or reaches the configured attempt limit.

  Use `/judge` to configure the default judge model and max attempts used by future goals.

  Approved plans can be selected as a goal from the inline plan approval UI, slash commands can opt into `/goal/<command>` with top-level `goal: true`, and skills can opt into goal commands with `metadata.goal: true`. `/goal` objectives can also span multiple lines.

- Added signal-based follow-up support for Mastra Code. ([#16231](https://github.com/mastra-ai/mastra/pull/16231))

  Text submitted while an agent run is active now continues the current thread, shows as pending until the signal echo confirms it, and avoids duplicate stream rendering by following thread output through one subscription owner.

  For example, pressing `Ctrl+F` while the agent is streaming queues the editor contents as a follow-up signal instead of waiting for the run to finish:

  ```ts
  const signal = harness.sendSignal({ content: 'one more constraint: keep the fix minimal' });
  await signal.accepted;
  ```

- Improved MastraCode task tracking so agents keep stable task IDs in prompts and update one task at a time while working. ([#16254](https://github.com/mastra-ai/mastra/pull/16254))

  MastraCode now preserves Harness task IDs in state, includes those IDs in the current task list prompt, and replays structured task snapshots from full thread history when a thread reloads. The TUI keeps successful task updates quiet, shows task-tool failures inline, avoids duplicate completed-task summaries, and restores replayed tasks through the Harness display-state API.

  MastraCode also documents the structured `task_check` result fields in agent guidance and keeps streaming `task_write` input typed separately from normalized task state.

- You can now pass a `memory` option to `createMastraCode()` to override the default memory instance or factory. This gives you a supported way to plug in custom memory behavior without depending on Mastra Code's default setup. ([#13891](https://github.com/mastra-ai/mastra/pull/13891))

  ```ts
  import { createMastraCode } from 'mastracode';

  const mastraCode = await createMastraCode({
    memory: myCustomMemory,
  });
  ```

- Added GitHub Copilot OAuth login (`/login` → GitHub Copilot) so anyone with an active Copilot subscription can use Mastra Code without separate OpenAI or Anthropic keys. The flow uses the standard GitHub device code OAuth, supports GitHub Enterprise hosts, and automatically refreshes the short-lived Copilot bearer token. ([#16129](https://github.com/mastra-ai/mastra/pull/16129))

  A new **GitHub Copilot** mode pack is selectable from the onboarding wizard and `/models`. The built-in defaults are:
  - _plan_: `github-copilot/gemini-2.5-pro`
  - _build_: `github-copilot/gpt-4.1`
  - _fast_: `github-copilot/grok-code-fast-1`

  After login, the available Copilot models are fetched live from the `/models` endpoint, filtered to picker-enabled, non-policy-disabled entries, and cached for 10 minutes. Mastra Code now uses the generic OpenAI-compatible AI SDK adapter pointed directly at GitHub Copilot's API instead of rewriting OpenAI provider URLs, and applies Gemini-compatible tool schemas for Copilot Gemini models.

### Patch Changes

- Fixed plan approval so accepting a plan can switch modes after the waiting plan tool resolves, clears stale abort state before starting the approved goal, and injects the goal trigger directly instead of queueing a follow-up. ([#16340](https://github.com/mastra-ai/mastra/pull/16340))

- Updated the generated project template and runtime bootstrap to use `MastraStorageExporter` and `MastraPlatformExporter` from `@mastra/observability`. ([#16223](https://github.com/mastra-ai/mastra/pull/16223))

- Fixed setup, settings, selectors, and non-chat configuration prompts so they open as neutral overlays with stable modal sizing, while keeping active chat interactions inline. ([#16274](https://github.com/mastra-ai/mastra/pull/16274))

- Improve README by adding links and screenshots ([#16250](https://github.com/mastra-ai/mastra/pull/16250))

- Fixed goal reminders in MastraCode to continue through signals without duplicating prompts. Updated core signal stream completion handling so idle-started reminder runs emit the expected lifecycle events. ([#16231](https://github.com/mastra-ai/mastra/pull/16231))

- dependencies updates: ([#16126](https://github.com/mastra-ai/mastra/pull/16126))
  - Updated dependency [`@ai-sdk/anthropic@^3.0.74` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/3.0.74) (from `^3.0.71`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai@^3.0.58` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai/v/3.0.58) (from `^3.0.53`, in `dependencies`)
  - Updated dependency [`ai@^6.0.174` ↗︎](https://www.npmjs.com/package/ai/v/6.0.174) (from `^6.0.168`, in `dependencies`)

- dependencies updates: ([#16398](https://github.com/mastra-ai/mastra/pull/16398))
  - Updated dependency [`@ai-sdk/anthropic@^3.0.76` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/3.0.76) (from `^3.0.74`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai@^3.0.63` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai/v/3.0.63) (from `^3.0.58`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai-compatible@^2.0.47` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai-compatible/v/2.0.47) (from `^2.0.45`, in `dependencies`)
  - Updated dependency [`ai@^6.0.176` ↗︎](https://www.npmjs.com/package/ai/v/6.0.176) (from `^6.0.174`, in `dependencies`)

- Delegate gateway sync to `@mastra/core`'s `GatewayRegistry.syncGateways`, removing duplicated provider-fetch, type-generation, and atomic-write logic so mastracode stays in sync with core registry behavior. ([#16332](https://github.com/mastra-ai/mastra/pull/16332))

- Replace `js-tiktoken` with `tokenx` for MastraCode web search and extract result truncation to reduce bundle size while preserving lightweight token-estimated output limits. ([#16326](https://github.com/mastra-ai/mastra/pull/16326))

- Made caveman-style observations opt-in. Observations and reflections now default to standard prose; turn caveman style back on via `/om` → "Caveman observations". The setting persists per thread, restores when Mastra Code starts, and new threads inherit the last selected value. ([#16275](https://github.com/mastra-ai/mastra/pull/16275))

- Improved Mastra Code startup time by loading only the most recent thread messages during initial render, using app-specific local LibSQL PRAGMA tuning, and deferring browser setup, gateway sync, and update checks until after first render. ([#16513](https://github.com/mastra-ai/mastra/pull/16513))

- Fixed OpenAI Codex login when the default callback port is already in use. The login flow now falls back to the Codex-supported fallback port and shows a clear warning when both supported callback ports are unavailable. ([#16294](https://github.com/mastra-ai/mastra/pull/16294))

- Enabled `ProviderHistoryCompat` by default for MastraCode agents. MastraCode now applies provider-boundary prompt compatibility fixes before model requests and keeps the existing API-error recovery path for provider validation errors. ([#16176](https://github.com/mastra-ai/mastra/pull/16176))

- Updated dependencies [[`9f17410`](https://github.com/mastra-ai/mastra/commit/9f1741080def23d42ee50b39887a385ae316a3c6), [`7ad5585`](https://github.com/mastra-ai/mastra/commit/7ad55856406f1de398dc713f6a9eaa78b2784bb6), [`ac47842`](https://github.com/mastra-ai/mastra/commit/ac478427aa7a5f5fdaed633a911218689b438c60), [`a68d854`](https://github.com/mastra-ai/mastra/commit/a68d854bf3d042bef7d5e2f6b7d35e311673888b), [`cc189cc`](https://github.com/mastra-ai/mastra/commit/cc189cc0128eb7af233476b5e421ec6888bffde7), [`d1fdbd0`](https://github.com/mastra-ai/mastra/commit/d1fdbd012add5623cb7e6b7f882b605ab358bbb4), [`210ea7a`](https://github.com/mastra-ai/mastra/commit/210ea7af559791b73a44fc9c12179908aaa3183f), [`7c275a8`](https://github.com/mastra-ai/mastra/commit/7c275a810595e1a6c41ccc39720531ab65734700), [`f14f5ec`](https://github.com/mastra-ai/mastra/commit/f14f5ecb6befa49ca19dd854b980955a001fcff1), [`bae019e`](https://github.com/mastra-ai/mastra/commit/bae019ecb6694da96909f7ec7b9eb3a0a33aa887), [`890b24c`](https://github.com/mastra-ai/mastra/commit/890b24cc7d32ed6aa4dfe253e54dc6bf4099f690), [`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`6742347`](https://github.com/mastra-ai/mastra/commit/6742347d71955d7639adc9ddf6ff8282de7ee3ba), [`b59316f`](https://github.com/mastra-ai/mastra/commit/b59316ffa0f7688165b0f9c81ccdf85da461e5b2), [`0f48ebf`](https://github.com/mastra-ai/mastra/commit/0f48ebfc7ac7897b2092a189f45751924cf56d1c), [`37c0dc5`](https://github.com/mastra-ai/mastra/commit/37c0dc5697d343db98628bf867bf71ce6deec6d7), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`9d71101`](https://github.com/mastra-ai/mastra/commit/9d71101921decb5b8d45734b6a91b6b740c7d465), [`83218c8`](https://github.com/mastra-ai/mastra/commit/83218c88b37773c9424fbe733b37be556e55e94d), [`ef6b584`](https://github.com/mastra-ai/mastra/commit/ef6b5847ac33c0a7e80af3a86e8801e2933dd3ee), [`c6eb39e`](https://github.com/mastra-ai/mastra/commit/c6eb39ea6dca381c6563cb240237fbe608e02f93), [`7b0ad1f`](https://github.com/mastra-ai/mastra/commit/7b0ad1f5c53dc118c6da12ae82ae2587037dc2b8), [`d91ebe2`](https://github.com/mastra-ai/mastra/commit/d91ebe28ee065d8f2ed6df741c3c07f58d359529), [`62666c3`](https://github.com/mastra-ai/mastra/commit/62666c367eaeac3941ead454b1d38810cc855721), [`33f5061`](https://github.com/mastra-ai/mastra/commit/33f5061cd1c0335020c3faae61ce96de822854fa), [`4af2160`](https://github.com/mastra-ai/mastra/commit/4af2160322f4718cac421930cce85641e9512389), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`265ec9f`](https://github.com/mastra-ai/mastra/commit/265ec9f887b5c81255c873a76ff7796f16e4f99b), [`b2fd6be`](https://github.com/mastra-ai/mastra/commit/b2fd6beef989f5e463c9a33d8a6c20ac1800e011), [`ce01024`](https://github.com/mastra-ai/mastra/commit/ce010242eee9bdfc09e4c26725b9d37998679a8d), [`6ce80bf`](https://github.com/mastra-ai/mastra/commit/6ce80bf4872a891e0bddf8b80561a80584efb14b), [`0764baf`](https://github.com/mastra-ai/mastra/commit/0764baf9d67cfdb310391a93837511f454a74475), [`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`136c959`](https://github.com/mastra-ai/mastra/commit/136c9592fb0eeb0cd212f28629d8a29b7557a2fc), [`bd977e6`](https://github.com/mastra-ai/mastra/commit/bd977e6056fe9bdfb0925f6796b2141f65db3e36), [`9268531`](https://github.com/mastra-ai/mastra/commit/9268531e7ec4be98beeba3b3ae8be0a7ea380662), [`00106be`](https://github.com/mastra-ai/mastra/commit/00106bede59b81e5b0e9cd6aad8d3b5dbc336387), [`13ead79`](https://github.com/mastra-ai/mastra/commit/13ead79149486b88144db7e11e6ff551caef5be1), [`dccd8f1`](https://github.com/mastra-ai/mastra/commit/dccd8f1f8b8f1ad203b77556207e5529567c616d), [`4df7cc7`](https://github.com/mastra-ai/mastra/commit/4df7cc79342fd065fe7fdeef93c094db14b12bcd), [`f180e49`](https://github.com/mastra-ai/mastra/commit/f180e4990e71b04c9a475b523584071712f0048f), [`9260e01`](https://github.com/mastra-ai/mastra/commit/9260e015276fb1b500f7878ee452b47476bf1583), [`2f6c54e`](https://github.com/mastra-ai/mastra/commit/2f6c54e17c041cac1def54baaa6b771647836414), [`4999667`](https://github.com/mastra-ai/mastra/commit/49996678b68356cad7f088430009690406c50fbd), [`aca3121`](https://github.com/mastra-ai/mastra/commit/aca31211233dac25459f140ea4fcfb3a5af64c18), [`e06a159`](https://github.com/mastra-ai/mastra/commit/e06a1598ca07a6c3778aefc2a2d288363c6294ff), [`bae381b`](https://github.com/mastra-ai/mastra/commit/bae381b57cdb8d161340642b47d892de0706d464), [`8781d45`](https://github.com/mastra-ai/mastra/commit/8781d452895df792b54eac8e4bdbc3559affa308), [`4dd900d`](https://github.com/mastra-ai/mastra/commit/4dd900d75dfe9be89f8c15188b368a8622aa1e18), [`b560d6f`](https://github.com/mastra-ai/mastra/commit/b560d6f88b9b904b15c10f75c949eb145bc27684), [`99869ec`](https://github.com/mastra-ai/mastra/commit/99869ecb1f2aa6dfcc44fa4e843e5ee0344efa64), [`900d086`](https://github.com/mastra-ai/mastra/commit/900d086bb737b9cf2fcf68f11b0389b801a2738c), [`c50ebc3`](https://github.com/mastra-ai/mastra/commit/c50ebc34da71044558315735e69bfb94fcfb74bf), [`4c0e286`](https://github.com/mastra-ai/mastra/commit/4c0e28637c9cfb4f416549b55e97ebfa13319dfc), [`7b0ad1f`](https://github.com/mastra-ai/mastra/commit/7b0ad1f5c53dc118c6da12ae82ae2587037dc2b8), [`50f5884`](https://github.com/mastra-ai/mastra/commit/50f5884b412dc05924a4c306c05eef7fb95a4aa1), [`55f1e2d`](https://github.com/mastra-ai/mastra/commit/55f1e2d65425b95a49ae788053b266f256e38c96), [`4ff5bdf`](https://github.com/mastra-ai/mastra/commit/4ff5bdfe170cba6dfb5260c6af0f4ba668430772), [`9cdf38e`](https://github.com/mastra-ai/mastra/commit/9cdf38e58506e1109c8b38f97cd7770978a4218e), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`25184ff`](https://github.com/mastra-ai/mastra/commit/25184ffaf1293ec95119426eb1a1f8d38831b96c), [`db34bc6`](https://github.com/mastra-ai/mastra/commit/db34bc6fb36cf125bda0c46be4d3fdc774b70cc4), [`990851e`](https://github.com/mastra-ai/mastra/commit/990851edcb0e30be5c2c18b6532f1a876cc2d335), [`bbcd93c`](https://github.com/mastra-ai/mastra/commit/bbcd93cf7d8aa1007d6d84bfd033b8015c912087), [`8373ff4`](https://github.com/mastra-ai/mastra/commit/8373ff46745d77af79f183c4470f80fa2727a6b2), [`00ef282`](https://github.com/mastra-ai/mastra/commit/00ef2826034d006b984b3f19cd33ba0bba14d6c6), [`d48a705`](https://github.com/mastra-ai/mastra/commit/d48a705ff3dfbdc7a996e07ecd8293b5effd9a2a), [`308bd07`](https://github.com/mastra-ai/mastra/commit/308bd074f35cef0c75d82fc1eb19382fe04ecf6f), [`6068a6c`](https://github.com/mastra-ai/mastra/commit/6068a6c42950fad3ebfc92346417896ba60803d2), [`36b3bbf`](https://github.com/mastra-ai/mastra/commit/36b3bbf5a8d59f7e23d47e29340e76c681b4929c), [`d86f031`](https://github.com/mastra-ai/mastra/commit/d86f031eb6b0b2570145afafea664e59bf688962), [`b275631`](https://github.com/mastra-ai/mastra/commit/b275631dc10541a482b2e2d4a3e3cfa843bd5fa1), [`00106be`](https://github.com/mastra-ai/mastra/commit/00106bede59b81e5b0e9cd6aad8d3b5dbc336387), [`4999667`](https://github.com/mastra-ai/mastra/commit/49996678b68356cad7f088430009690406c50fbd), [`bd36d8e`](https://github.com/mastra-ai/mastra/commit/bd36d8eb6de8c9a0310352649dbd4b06703c2299), [`11c1528`](https://github.com/mastra-ai/mastra/commit/11c152848c5d0ef227184853b5040f5b41ee7b1e), [`33767a0`](https://github.com/mastra-ai/mastra/commit/33767a0e3762beeb33dab03b1608b6d5f405fc94), [`4999667`](https://github.com/mastra-ai/mastra/commit/49996678b68356cad7f088430009690406c50fbd), [`e2a079c`](https://github.com/mastra-ai/mastra/commit/e2a079cc3755b1895f7bd5dc36e9be81b11c7c22), [`f70160c`](https://github.com/mastra-ai/mastra/commit/f70160c53c366e71e1d8dde2c6aeaf1b62fb77e6), [`8ac9141`](https://github.com/mastra-ai/mastra/commit/8ac9141439caa8fdd674944c4d84f29b3c730296), [`25184ff`](https://github.com/mastra-ai/mastra/commit/25184ffaf1293ec95119426eb1a1f8d38831b96c), [`534a456`](https://github.com/mastra-ai/mastra/commit/534a456a25e4df1e5407e7e632f4cb3b1fa14f9d), [`105e454`](https://github.com/mastra-ai/mastra/commit/105e454c95af06a7c741c15969d8f9b0f02463a7), [`aebde9c`](https://github.com/mastra-ai/mastra/commit/aebde9cfacf56592c6b6350cae721740fe090b8a), [`36bae07`](https://github.com/mastra-ai/mastra/commit/36bae07c0e70b1b3006f2fd20830e8883dcbd066), [`5688881`](https://github.com/mastra-ai/mastra/commit/5688881669c7ed157f31ac77f6fc5f8d95ceea32)]:
  - @mastra/core@1.33.0
  - @mastra/duckdb@1.3.1
  - @mastra/stagehand@0.2.2
  - @mastra/agent-browser@0.2.2
  - @mastra/libsql@1.10.1
  - @mastra/observability@1.12.0
  - @mastra/memory@1.18.0
  - @mastra/pg@1.10.1
  - @mastra/schema-compat@1.2.10
  - @mastra/mcp@1.7.0

## 0.18.0-alpha.19

### Patch Changes

- Improved Mastra Code startup time by loading only the most recent thread messages during initial render, using app-specific local LibSQL PRAGMA tuning, and deferring browser setup, gateway sync, and update checks until after first render. ([#16513](https://github.com/mastra-ai/mastra/pull/16513))

- Updated dependencies [[`4999667`](https://github.com/mastra-ai/mastra/commit/49996678b68356cad7f088430009690406c50fbd), [`4999667`](https://github.com/mastra-ai/mastra/commit/49996678b68356cad7f088430009690406c50fbd), [`4999667`](https://github.com/mastra-ai/mastra/commit/49996678b68356cad7f088430009690406c50fbd)]:
  - @mastra/libsql@1.10.1-alpha.3
  - @mastra/core@1.33.0-alpha.17

## 0.18.0-alpha.18

### Patch Changes

- Updated dependencies [[`cc189cc`](https://github.com/mastra-ai/mastra/commit/cc189cc0128eb7af233476b5e421ec6888bffde7), [`bd977e6`](https://github.com/mastra-ai/mastra/commit/bd977e6056fe9bdfb0925f6796b2141f65db3e36)]:
  - @mastra/core@1.33.0-alpha.16
  - @mastra/pg@1.10.1-alpha.2

## 0.18.0-alpha.17

### Patch Changes

- Updated dependencies [[`8781d45`](https://github.com/mastra-ai/mastra/commit/8781d452895df792b54eac8e4bdbc3559affa308), [`105e454`](https://github.com/mastra-ai/mastra/commit/105e454c95af06a7c741c15969d8f9b0f02463a7)]:
  - @mastra/observability@1.12.0-alpha.4
  - @mastra/core@1.33.0-alpha.15

## 0.18.0-alpha.16

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.33.0-alpha.14

## 0.18.0-alpha.15

### Minor Changes

- Added signal-based follow-up support for Mastra Code. ([#16231](https://github.com/mastra-ai/mastra/pull/16231))

  Text submitted while an agent run is active now continues the current thread, shows as pending until the signal echo confirms it, and avoids duplicate stream rendering by following thread output through one subscription owner.

  For example, pressing `Ctrl+F` while the agent is streaming queues the editor contents as a follow-up signal instead of waiting for the run to finish:

  ```ts
  const signal = harness.sendSignal({ content: 'one more constraint: keep the fix minimal' });
  await signal.accepted;
  ```

### Patch Changes

- Fixed goal reminders in MastraCode to continue through signals without duplicating prompts. ([#16231](https://github.com/mastra-ai/mastra/pull/16231))

- Updated dependencies [[`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`ce01024`](https://github.com/mastra-ai/mastra/commit/ce010242eee9bdfc09e4c26725b9d37998679a8d), [`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`8373ff4`](https://github.com/mastra-ai/mastra/commit/8373ff46745d77af79f183c4470f80fa2727a6b2), [`11c1528`](https://github.com/mastra-ai/mastra/commit/11c152848c5d0ef227184853b5040f5b41ee7b1e)]:
  - @mastra/core@1.33.0-alpha.13

## 0.18.0-alpha.14

### Patch Changes

- Updated dependencies [[`f14f5ec`](https://github.com/mastra-ai/mastra/commit/f14f5ecb6befa49ca19dd854b980955a001fcff1), [`b59316f`](https://github.com/mastra-ai/mastra/commit/b59316ffa0f7688165b0f9c81ccdf85da461e5b2), [`bae381b`](https://github.com/mastra-ai/mastra/commit/bae381b57cdb8d161340642b47d892de0706d464), [`55f1e2d`](https://github.com/mastra-ai/mastra/commit/55f1e2d65425b95a49ae788053b266f256e38c96), [`d48a705`](https://github.com/mastra-ai/mastra/commit/d48a705ff3dfbdc7a996e07ecd8293b5effd9a2a)]:
  - @mastra/stagehand@0.2.2-alpha.0
  - @mastra/agent-browser@0.2.2-alpha.0
  - @mastra/core@1.33.0-alpha.12
  - @mastra/memory@1.18.0-alpha.4

## 0.18.0-alpha.13

### Patch Changes

- Updated dependencies [[`37c0dc5`](https://github.com/mastra-ai/mastra/commit/37c0dc5697d343db98628bf867bf71ce6deec6d7), [`ef6b584`](https://github.com/mastra-ai/mastra/commit/ef6b5847ac33c0a7e80af3a86e8801e2933dd3ee), [`4dd900d`](https://github.com/mastra-ai/mastra/commit/4dd900d75dfe9be89f8c15188b368a8622aa1e18), [`4ff5bdf`](https://github.com/mastra-ai/mastra/commit/4ff5bdfe170cba6dfb5260c6af0f4ba668430772), [`bbcd93c`](https://github.com/mastra-ai/mastra/commit/bbcd93cf7d8aa1007d6d84bfd033b8015c912087), [`308bd07`](https://github.com/mastra-ai/mastra/commit/308bd074f35cef0c75d82fc1eb19382fe04ecf6f)]:
  - @mastra/core@1.33.0-alpha.11

## 0.18.0-alpha.12

### Patch Changes

- Updated the generated project template and runtime bootstrap to use `MastraStorageExporter` and `MastraPlatformExporter` from `@mastra/observability`. ([#16223](https://github.com/mastra-ai/mastra/pull/16223))

- dependencies updates: ([#16398](https://github.com/mastra-ai/mastra/pull/16398))
  - Updated dependency [`@ai-sdk/anthropic@^3.0.76` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/3.0.76) (from `^3.0.74`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai@^3.0.63` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai/v/3.0.63) (from `^3.0.58`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai-compatible@^2.0.47` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai-compatible/v/2.0.47) (from `^2.0.45`, in `dependencies`)
  - Updated dependency [`ai@^6.0.176` ↗︎](https://www.npmjs.com/package/ai/v/6.0.176) (from `^6.0.174`, in `dependencies`)
- Updated dependencies [[`7ad5585`](https://github.com/mastra-ai/mastra/commit/7ad55856406f1de398dc713f6a9eaa78b2784bb6), [`210ea7a`](https://github.com/mastra-ai/mastra/commit/210ea7af559791b73a44fc9c12179908aaa3183f), [`83218c8`](https://github.com/mastra-ai/mastra/commit/83218c88b37773c9424fbe733b37be556e55e94d), [`265ec9f`](https://github.com/mastra-ai/mastra/commit/265ec9f887b5c81255c873a76ff7796f16e4f99b), [`6ce80bf`](https://github.com/mastra-ai/mastra/commit/6ce80bf4872a891e0bddf8b80561a80584efb14b), [`9268531`](https://github.com/mastra-ai/mastra/commit/9268531e7ec4be98beeba3b3ae8be0a7ea380662), [`13ead79`](https://github.com/mastra-ai/mastra/commit/13ead79149486b88144db7e11e6ff551caef5be1), [`50f5884`](https://github.com/mastra-ai/mastra/commit/50f5884b412dc05924a4c306c05eef7fb95a4aa1), [`bd36d8e`](https://github.com/mastra-ai/mastra/commit/bd36d8eb6de8c9a0310352649dbd4b06703c2299), [`8ac9141`](https://github.com/mastra-ai/mastra/commit/8ac9141439caa8fdd674944c4d84f29b3c730296)]:
  - @mastra/core@1.33.0-alpha.10
  - @mastra/observability@1.12.0-alpha.3

## 0.18.0-alpha.11

### Patch Changes

- Updated dependencies [[`5688881`](https://github.com/mastra-ai/mastra/commit/5688881669c7ed157f31ac77f6fc5f8d95ceea32)]:
  - @mastra/core@1.33.0-alpha.9

## 0.18.0-alpha.10

### Minor Changes

- Added GitHub Copilot OAuth login (`/login` → GitHub Copilot) so anyone with an active Copilot subscription can use Mastra Code without separate OpenAI or Anthropic keys. The flow uses the standard GitHub device code OAuth, supports GitHub Enterprise hosts, and automatically refreshes the short-lived Copilot bearer token. ([#16129](https://github.com/mastra-ai/mastra/pull/16129))

  A new **GitHub Copilot** mode pack is selectable from the onboarding wizard and `/models`. The built-in defaults are:
  - _plan_: `github-copilot/gemini-2.5-pro`
  - _build_: `github-copilot/gpt-4.1`
  - _fast_: `github-copilot/grok-code-fast-1`

  After login, the available Copilot models are fetched live from the `/models` endpoint, filtered to picker-enabled, non-policy-disabled entries, and cached for 10 minutes. Mastra Code now uses the generic OpenAI-compatible AI SDK adapter pointed directly at GitHub Copilot's API instead of rewriting OpenAI provider URLs, and applies Gemini-compatible tool schemas for Copilot Gemini models.

### Patch Changes

- Fixed plan approval so accepting a plan can switch modes after the waiting plan tool resolves, clears stale abort state before starting the approved goal, and injects the goal trigger directly instead of queueing a follow-up. ([#16340](https://github.com/mastra-ai/mastra/pull/16340))

- Delegate gateway sync to `@mastra/core`'s `GatewayRegistry.syncGateways`, removing duplicated provider-fetch, type-generation, and atomic-write logic so mastracode stays in sync with core registry behavior. ([#16332](https://github.com/mastra-ai/mastra/pull/16332))

- Updated dependencies [[`7c275a8`](https://github.com/mastra-ai/mastra/commit/7c275a810595e1a6c41ccc39720531ab65734700), [`890b24c`](https://github.com/mastra-ai/mastra/commit/890b24cc7d32ed6aa4dfe253e54dc6bf4099f690), [`0f48ebf`](https://github.com/mastra-ai/mastra/commit/0f48ebfc7ac7897b2092a189f45751924cf56d1c), [`9d71101`](https://github.com/mastra-ai/mastra/commit/9d71101921decb5b8d45734b6a91b6b740c7d465), [`f180e49`](https://github.com/mastra-ai/mastra/commit/f180e4990e71b04c9a475b523584071712f0048f), [`9260e01`](https://github.com/mastra-ai/mastra/commit/9260e015276fb1b500f7878ee452b47476bf1583), [`2f6c54e`](https://github.com/mastra-ai/mastra/commit/2f6c54e17c041cac1def54baaa6b771647836414), [`e06a159`](https://github.com/mastra-ai/mastra/commit/e06a1598ca07a6c3778aefc2a2d288363c6294ff), [`c50ebc3`](https://github.com/mastra-ai/mastra/commit/c50ebc34da71044558315735e69bfb94fcfb74bf), [`db34bc6`](https://github.com/mastra-ai/mastra/commit/db34bc6fb36cf125bda0c46be4d3fdc774b70cc4), [`33767a0`](https://github.com/mastra-ai/mastra/commit/33767a0e3762beeb33dab03b1608b6d5f405fc94)]:
  - @mastra/core@1.33.0-alpha.8
  - @mastra/libsql@1.10.1-alpha.2
  - @mastra/memory@1.18.0-alpha.3
  - @mastra/pg@1.10.1-alpha.1
  - @mastra/schema-compat@1.2.10-alpha.0
  - @mastra/observability@1.12.0-alpha.2
  - @mastra/mcp@1.7.0

## 0.18.0-alpha.9

### Minor Changes

- Improved MastraCode task tracking so agents keep stable task IDs in prompts and update one task at a time while working. ([#16254](https://github.com/mastra-ai/mastra/pull/16254))

  MastraCode now preserves Harness task IDs in state, includes those IDs in the current task list prompt, and replays structured task snapshots from full thread history when a thread reloads. The TUI keeps successful task updates quiet, shows task-tool failures inline, avoids duplicate completed-task summaries, and restores replayed tasks through the Harness display-state API.

  MastraCode also documents the structured `task_check` result fields in agent guidance and keeps streaming `task_write` input typed separately from normalized task state.

### Patch Changes

- Updated dependencies [[`6742347`](https://github.com/mastra-ai/mastra/commit/6742347d71955d7639adc9ddf6ff8282de7ee3ba), [`7b0ad1f`](https://github.com/mastra-ai/mastra/commit/7b0ad1f5c53dc118c6da12ae82ae2587037dc2b8), [`62666c3`](https://github.com/mastra-ai/mastra/commit/62666c367eaeac3941ead454b1d38810cc855721), [`4af2160`](https://github.com/mastra-ai/mastra/commit/4af2160322f4718cac421930cce85641e9512389), [`b2fd6be`](https://github.com/mastra-ai/mastra/commit/b2fd6beef989f5e463c9a33d8a6c20ac1800e011), [`136c959`](https://github.com/mastra-ai/mastra/commit/136c9592fb0eeb0cd212f28629d8a29b7557a2fc), [`00106be`](https://github.com/mastra-ai/mastra/commit/00106bede59b81e5b0e9cd6aad8d3b5dbc336387), [`4df7cc7`](https://github.com/mastra-ai/mastra/commit/4df7cc79342fd065fe7fdeef93c094db14b12bcd), [`aca3121`](https://github.com/mastra-ai/mastra/commit/aca31211233dac25459f140ea4fcfb3a5af64c18), [`7b0ad1f`](https://github.com/mastra-ai/mastra/commit/7b0ad1f5c53dc118c6da12ae82ae2587037dc2b8), [`9cdf38e`](https://github.com/mastra-ai/mastra/commit/9cdf38e58506e1109c8b38f97cd7770978a4218e), [`990851e`](https://github.com/mastra-ai/mastra/commit/990851edcb0e30be5c2c18b6532f1a876cc2d335), [`6068a6c`](https://github.com/mastra-ai/mastra/commit/6068a6c42950fad3ebfc92346417896ba60803d2), [`00106be`](https://github.com/mastra-ai/mastra/commit/00106bede59b81e5b0e9cd6aad8d3b5dbc336387), [`e2a079c`](https://github.com/mastra-ai/mastra/commit/e2a079cc3755b1895f7bd5dc36e9be81b11c7c22), [`f70160c`](https://github.com/mastra-ai/mastra/commit/f70160c53c366e71e1d8dde2c6aeaf1b62fb77e6), [`534a456`](https://github.com/mastra-ai/mastra/commit/534a456a25e4df1e5407e7e632f4cb3b1fa14f9d), [`36bae07`](https://github.com/mastra-ai/mastra/commit/36bae07c0e70b1b3006f2fd20830e8883dcbd066)]:
  - @mastra/core@1.33.0-alpha.7
  - @mastra/libsql@1.10.1-alpha.1
  - @mastra/observability@1.12.0-alpha.1
  - @mastra/memory@1.18.0-alpha.2

## 0.18.0-alpha.8

### Patch Changes

- Replace `js-tiktoken` with `tokenx` for MastraCode web search and extract result truncation to reduce bundle size while preserving lightweight token-estimated output limits. ([#16326](https://github.com/mastra-ai/mastra/pull/16326))

- Made caveman-style observations opt-in. Observations and reflections now default to standard prose; turn caveman style back on via `/om` → "Caveman observations". The setting persists per thread, restores when Mastra Code starts, and new threads inherit the last selected value. ([#16275](https://github.com/mastra-ai/mastra/pull/16275))

- Updated dependencies [[`b560d6f`](https://github.com/mastra-ai/mastra/commit/b560d6f88b9b904b15c10f75c949eb145bc27684), [`36b3bbf`](https://github.com/mastra-ai/mastra/commit/36b3bbf5a8d59f7e23d47e29340e76c681b4929c), [`b275631`](https://github.com/mastra-ai/mastra/commit/b275631dc10541a482b2e2d4a3e3cfa843bd5fa1)]:
  - @mastra/core@1.33.0-alpha.6
  - @mastra/memory@1.17.6-alpha.1

## 0.18.0-alpha.7

### Patch Changes

- Updated dependencies [[`a68d854`](https://github.com/mastra-ai/mastra/commit/a68d854bf3d042bef7d5e2f6b7d35e311673888b), [`00ef282`](https://github.com/mastra-ai/mastra/commit/00ef2826034d006b984b3f19cd33ba0bba14d6c6)]:
  - @mastra/duckdb@1.3.1-alpha.0
  - @mastra/observability@1.12.0-alpha.0

## 0.18.0-alpha.6

### Minor Changes

- Added `/goal` to Mastra Code, a persistent autonomous task loop similar to the goal modes in Codex and Hermes Agent. ([#16065](https://github.com/mastra-ai/mastra/pull/16065))

  A user can start a goal with `/goal <objective>`. Mastra Code saves that objective to the current thread, runs the normal assistant turn, then asks a separate judge model whether the goal is `done`, should `continue`, or is `waiting` on an explicit user checkpoint. When the judge says to continue, Mastra Code feeds the judge feedback back into the conversation and keeps working until the goal is complete, paused, cleared, or reaches the configured attempt limit.

  Use `/judge` to configure the default judge model and max attempts used by future goals.

  Approved plans can be selected as a goal from the inline plan approval UI, slash commands can opt into `/goal/<command>` with top-level `goal: true`, and skills can opt into goal commands with `metadata.goal: true`. `/goal` objectives can also span multiple lines.

### Patch Changes

- Fixed OpenAI Codex login when the default callback port is already in use. The login flow now falls back to the Codex-supported fallback port and shows a clear warning when both supported callback ports are unavailable. ([#16294](https://github.com/mastra-ai/mastra/pull/16294))

- Updated dependencies [[`bae019e`](https://github.com/mastra-ai/mastra/commit/bae019ecb6694da96909f7ec7b9eb3a0a33aa887), [`33f5061`](https://github.com/mastra-ai/mastra/commit/33f5061cd1c0335020c3faae61ce96de822854fa), [`99869ec`](https://github.com/mastra-ai/mastra/commit/99869ecb1f2aa6dfcc44fa4e843e5ee0344efa64), [`d86f031`](https://github.com/mastra-ai/mastra/commit/d86f031eb6b0b2570145afafea664e59bf688962)]:
  - @mastra/core@1.33.0-alpha.5

## 0.18.0-alpha.5

### Patch Changes

- dependencies updates: ([#16126](https://github.com/mastra-ai/mastra/pull/16126))
  - Updated dependency [`@ai-sdk/anthropic@^3.0.74` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/3.0.74) (from `^3.0.71`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai@^3.0.58` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai/v/3.0.58) (from `^3.0.53`, in `dependencies`)
  - Updated dependency [`ai@^6.0.174` ↗︎](https://www.npmjs.com/package/ai/v/6.0.174) (from `^6.0.168`, in `dependencies`)
- Updated dependencies [[`9f17410`](https://github.com/mastra-ai/mastra/commit/9f1741080def23d42ee50b39887a385ae316a3c6), [`c6eb39e`](https://github.com/mastra-ai/mastra/commit/c6eb39ea6dca381c6563cb240237fbe608e02f93), [`900d086`](https://github.com/mastra-ai/mastra/commit/900d086bb737b9cf2fcf68f11b0389b801a2738c), [`4c0e286`](https://github.com/mastra-ai/mastra/commit/4c0e28637c9cfb4f416549b55e97ebfa13319dfc), [`25184ff`](https://github.com/mastra-ai/mastra/commit/25184ffaf1293ec95119426eb1a1f8d38831b96c), [`25184ff`](https://github.com/mastra-ai/mastra/commit/25184ffaf1293ec95119426eb1a1f8d38831b96c), [`aebde9c`](https://github.com/mastra-ai/mastra/commit/aebde9cfacf56592c6b6350cae721740fe090b8a)]:
  - @mastra/core@1.33.0-alpha.4
  - @mastra/libsql@1.10.1-alpha.0
  - @mastra/pg@1.10.1-alpha.0

## 0.18.0-alpha.4

### Patch Changes

- Updated dependencies [[`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047)]:
  - @mastra/core@1.33.0-alpha.3

## 0.18.0-alpha.3

### Minor Changes

- You can now pass a `memory` option to `createMastraCode()` to override the default memory instance or factory. This gives you a supported way to plug in custom memory behavior without depending on Mastra Code's default setup. ([#13891](https://github.com/mastra-ai/mastra/pull/13891))

  ```ts
  import { createMastraCode } from 'mastracode';

  const mastraCode = await createMastraCode({
    memory: myCustomMemory,
  });
  ```

### Patch Changes

- Fixed setup, settings, selectors, and non-chat configuration prompts so they open as neutral overlays with stable modal sizing, while keeping active chat interactions inline. ([#16274](https://github.com/mastra-ai/mastra/pull/16274))

- Enabled `ProviderHistoryCompat` by default for MastraCode agents. MastraCode now applies provider-boundary prompt compatibility fixes before model requests and keeps the existing API-error recovery path for provider validation errors. ([#16176](https://github.com/mastra-ai/mastra/pull/16176))

- Updated dependencies [[`d1fdbd0`](https://github.com/mastra-ai/mastra/commit/d1fdbd012add5623cb7e6b7f882b605ab358bbb4), [`d91ebe2`](https://github.com/mastra-ai/mastra/commit/d91ebe28ee065d8f2ed6df741c3c07f58d359529)]:
  - @mastra/core@1.33.0-alpha.2

## 0.17.3-alpha.2

### Patch Changes

- Improve README by adding links and screenshots ([#16250](https://github.com/mastra-ai/mastra/pull/16250))

- Updated dependencies [[`dccd8f1`](https://github.com/mastra-ai/mastra/commit/dccd8f1f8b8f1ad203b77556207e5529567c616d)]:
  - @mastra/core@1.33.0-alpha.1

## 0.17.3-alpha.1

### Patch Changes

- Updated dependencies [[`0764baf`](https://github.com/mastra-ai/mastra/commit/0764baf9d67cfdb310391a93837511f454a74475)]:
  - @mastra/memory@1.17.6-alpha.0

## 0.17.3-alpha.0

### Patch Changes

- Updated dependencies [[`ac47842`](https://github.com/mastra-ai/mastra/commit/ac478427aa7a5f5fdaed633a911218689b438c60)]:
  - @mastra/core@1.33.0-alpha.0

## 0.17.2

### Patch Changes

- Updated dependencies [[`cc0469d`](https://github.com/mastra-ai/mastra/commit/cc0469d671d6f7a426013e4425f9501da6fa45f2)]:
  - @mastra/core@1.32.1

## 0.17.2-alpha.0

### Patch Changes

- Updated dependencies [[`cc0469d`](https://github.com/mastra-ai/mastra/commit/cc0469d671d6f7a426013e4425f9501da6fa45f2)]:
  - @mastra/core@1.32.1-alpha.0

## 0.17.1

### Patch Changes

- Added the OS temp directory (/tmp) as a default allowed workspace path so the agent can use it as a scratchpad without requesting access each time ([#16094](https://github.com/mastra-ai/mastra/pull/16094))

- Normalize Enter/Escape key handling in the `/settings` storage backend submenu so submit/cancel works reliably across terminal emulators. ([#16135](https://github.com/mastra-ai/mastra/pull/16135))

- Only log skill directories that actually exist on disk, reducing startup noise ([#16068](https://github.com/mastra-ai/mastra/pull/16068))

- Updated dependencies [[`6dcd65f`](https://github.com/mastra-ai/mastra/commit/6dcd65f2a34069e6dc43ba35f1d11119b9b40bef), [`86c0298`](https://github.com/mastra-ai/mastra/commit/86c0298e647306423c842f9d5ac827bd616bd13d), [`94dcd79`](https://github.com/mastra-ai/mastra/commit/94dcd79ff180c43b2d4527fe9f5aa6b88db36934), [`c05c9a1`](https://github.com/mastra-ai/mastra/commit/c05c9a13230988cef6d438a62f37760f31927bc7), [`ca28c23`](https://github.com/mastra-ai/mastra/commit/ca28c232a2f18801a6cf20fe053479237b4d4fb0), [`c5daf48`](https://github.com/mastra-ai/mastra/commit/c5daf48556e98c46ae06caf00f92c249912007e9), [`e24aacb`](https://github.com/mastra-ai/mastra/commit/e24aacba07bd66f5d95b636dc24016fca26b52cf), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`7fce309`](https://github.com/mastra-ai/mastra/commit/7fce30912b14170bfc41f0ac736cca0f39fe0cd4), [`1d64a76`](https://github.com/mastra-ai/mastra/commit/1d64a765861a0772ea187bab76e5ed37bf82d042), [`1c2dda8`](https://github.com/mastra-ai/mastra/commit/1c2dda805fbfccc0abf55d4cb20cc34402dc3f0c), [`86c0298`](https://github.com/mastra-ai/mastra/commit/86c0298e647306423c842f9d5ac827bd616bd13d), [`c721164`](https://github.com/mastra-ai/mastra/commit/c7211643f7ac861f83b19a3757cc921487fc9d75), [`1b55954`](https://github.com/mastra-ai/mastra/commit/1b559541c1e08a10e49d01ffc51a634dfc37a286), [`7997c2e`](https://github.com/mastra-ai/mastra/commit/7997c2e55ddd121562a4098cd8d2b89c68433bf1), [`319a94c`](https://github.com/mastra-ai/mastra/commit/319a94c6bf1f8f4ac8249a40b0c99b9c1e0d4598), [`5adc55e`](https://github.com/mastra-ai/mastra/commit/5adc55e63407be8ee977914957d68bcc2a075ceb), [`5adc55e`](https://github.com/mastra-ai/mastra/commit/5adc55e63407be8ee977914957d68bcc2a075ceb), [`5adc55e`](https://github.com/mastra-ai/mastra/commit/5adc55e63407be8ee977914957d68bcc2a075ceb), [`568777e`](https://github.com/mastra-ai/mastra/commit/568777ea8af77a672270b448dfd3996f9e75a964), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`a0d9b6d`](https://github.com/mastra-ai/mastra/commit/a0d9b6d6b810aeaa9e177a0dcc99a4402e609634), [`e97ccb9`](https://github.com/mastra-ai/mastra/commit/e97ccb900f8b7a390ce82c9f8eb8d6eb2c5e3777), [`c5daf48`](https://github.com/mastra-ai/mastra/commit/c5daf48556e98c46ae06caf00f92c249912007e9), [`70017d7`](https://github.com/mastra-ai/mastra/commit/70017d72ab741b5d7040e2a15c251a317782e39e), [`568777e`](https://github.com/mastra-ai/mastra/commit/568777ea8af77a672270b448dfd3996f9e75a964), [`cd96779`](https://github.com/mastra-ai/mastra/commit/cd9677937f113b2856dc8b9f3d4bdabcee58bb2e), [`b0c7022`](https://github.com/mastra-ai/mastra/commit/b0c70224f80dad7c0cdbfb22cbff22e0f75c064f), [`e4942bc`](https://github.com/mastra-ai/mastra/commit/e4942bc7fdc903572f7d84f26d5e15f9d39c763d), [`39a3768`](https://github.com/mastra-ai/mastra/commit/39a3768a980c31ee689c675aa0015609f76191c4)]:
  - @mastra/core@1.32.0
  - @mastra/duckdb@1.3.0
  - @mastra/libsql@1.10.0
  - @mastra/pg@1.10.0
  - @mastra/mcp@1.7.0
  - @mastra/memory@1.17.5
  - @mastra/observability@1.11.1

## 0.17.1-alpha.4

### Patch Changes

- Updated dependencies [[`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`1d64a76`](https://github.com/mastra-ai/mastra/commit/1d64a765861a0772ea187bab76e5ed37bf82d042), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`a0d9b6d`](https://github.com/mastra-ai/mastra/commit/a0d9b6d6b810aeaa9e177a0dcc99a4402e609634)]:
  - @mastra/core@1.32.0-alpha.4
  - @mastra/mcp@1.7.0-alpha.2
  - @mastra/memory@1.17.5-alpha.1

## 0.17.1-alpha.3

### Patch Changes

- Updated dependencies [[`94dcd79`](https://github.com/mastra-ai/mastra/commit/94dcd79ff180c43b2d4527fe9f5aa6b88db36934), [`ca28c23`](https://github.com/mastra-ai/mastra/commit/ca28c232a2f18801a6cf20fe053479237b4d4fb0)]:
  - @mastra/duckdb@1.3.0-alpha.1
  - @mastra/core@1.32.0-alpha.3
  - @mastra/libsql@1.10.0-alpha.1
  - @mastra/pg@1.10.0-alpha.1

## 0.17.1-alpha.2

### Patch Changes

- Normalize Enter/Escape key handling in the `/settings` storage backend submenu so submit/cancel works reliably across terminal emulators. ([#16135](https://github.com/mastra-ai/mastra/pull/16135))

- Updated dependencies [[`86c0298`](https://github.com/mastra-ai/mastra/commit/86c0298e647306423c842f9d5ac827bd616bd13d), [`c5daf48`](https://github.com/mastra-ai/mastra/commit/c5daf48556e98c46ae06caf00f92c249912007e9), [`7fce309`](https://github.com/mastra-ai/mastra/commit/7fce30912b14170bfc41f0ac736cca0f39fe0cd4), [`86c0298`](https://github.com/mastra-ai/mastra/commit/86c0298e647306423c842f9d5ac827bd616bd13d), [`7997c2e`](https://github.com/mastra-ai/mastra/commit/7997c2e55ddd121562a4098cd8d2b89c68433bf1), [`e97ccb9`](https://github.com/mastra-ai/mastra/commit/e97ccb900f8b7a390ce82c9f8eb8d6eb2c5e3777), [`c5daf48`](https://github.com/mastra-ai/mastra/commit/c5daf48556e98c46ae06caf00f92c249912007e9), [`cd96779`](https://github.com/mastra-ai/mastra/commit/cd9677937f113b2856dc8b9f3d4bdabcee58bb2e)]:
  - @mastra/core@1.32.0-alpha.2
  - @mastra/duckdb@1.3.0-alpha.0
  - @mastra/mcp@1.6.1-alpha.1

## 0.17.1-alpha.1

### Patch Changes

- Added the OS temp directory (/tmp) as a default allowed workspace path so the agent can use it as a scratchpad without requesting access each time ([#16094](https://github.com/mastra-ai/mastra/pull/16094))

- Only log skill directories that actually exist on disk, reducing startup noise ([#16068](https://github.com/mastra-ai/mastra/pull/16068))

- Updated dependencies [[`c05c9a1`](https://github.com/mastra-ai/mastra/commit/c05c9a13230988cef6d438a62f37760f31927bc7), [`e24aacb`](https://github.com/mastra-ai/mastra/commit/e24aacba07bd66f5d95b636dc24016fca26b52cf), [`c721164`](https://github.com/mastra-ai/mastra/commit/c7211643f7ac861f83b19a3757cc921487fc9d75), [`1b55954`](https://github.com/mastra-ai/mastra/commit/1b559541c1e08a10e49d01ffc51a634dfc37a286), [`319a94c`](https://github.com/mastra-ai/mastra/commit/319a94c6bf1f8f4ac8249a40b0c99b9c1e0d4598), [`5adc55e`](https://github.com/mastra-ai/mastra/commit/5adc55e63407be8ee977914957d68bcc2a075ceb), [`5adc55e`](https://github.com/mastra-ai/mastra/commit/5adc55e63407be8ee977914957d68bcc2a075ceb), [`5adc55e`](https://github.com/mastra-ai/mastra/commit/5adc55e63407be8ee977914957d68bcc2a075ceb), [`70017d7`](https://github.com/mastra-ai/mastra/commit/70017d72ab741b5d7040e2a15c251a317782e39e), [`e4942bc`](https://github.com/mastra-ai/mastra/commit/e4942bc7fdc903572f7d84f26d5e15f9d39c763d), [`39a3768`](https://github.com/mastra-ai/mastra/commit/39a3768a980c31ee689c675aa0015609f76191c4)]:
  - @mastra/core@1.32.0-alpha.1
  - @mastra/memory@1.17.5-alpha.0
  - @mastra/libsql@1.10.0-alpha.0
  - @mastra/pg@1.10.0-alpha.0
  - @mastra/observability@1.11.1-alpha.1

## 0.17.1-alpha.0

### Patch Changes

- Updated dependencies [[`6dcd65f`](https://github.com/mastra-ai/mastra/commit/6dcd65f2a34069e6dc43ba35f1d11119b9b40bef), [`1c2dda8`](https://github.com/mastra-ai/mastra/commit/1c2dda805fbfccc0abf55d4cb20cc34402dc3f0c), [`568777e`](https://github.com/mastra-ai/mastra/commit/568777ea8af77a672270b448dfd3996f9e75a964), [`568777e`](https://github.com/mastra-ai/mastra/commit/568777ea8af77a672270b448dfd3996f9e75a964)]:
  - @mastra/core@1.31.1-alpha.0
  - @mastra/observability@1.11.1-alpha.0
  - @mastra/mcp@1.6.1-alpha.0

## 0.17.0

### Minor Changes

- Free-text answers to the `ask_user` tool can now span multiple lines. Press ([#15395](https://github.com/mastra-ai/mastra/pull/15395))
  `Shift+Enter` or `\+Enter` to insert a newline, `Enter` to submit, and `Esc`
  to cancel — long answers wrap inside the input box instead of scrolling
  horizontally off-screen, and the raw text (including indentation and trailing
  newlines) is forwarded to the agent intact.

  Slash-command prompts that take short answers (paths, names, yes/no, model
  picks) keep the existing single-line input, so muscle memory for those
  prompts is unchanged.

  Internally, this is opt-in via a new `multiline: true` flag on
  `AskQuestionInlineComponent` / `AskQuestionDialogComponent`. The flag also
  flows through `createStreaming` and `activate`, so the multiline editor is
  available everywhere those components are mounted.

### Patch Changes

- Fixed user message box border misalignment when the first line of text fills the full width. The right border no longer extends past the top corner. ([#15993](https://github.com/mastra-ai/mastra/pull/15993))

- Updated dependencies [[`1723e09`](https://github.com/mastra-ai/mastra/commit/1723e099829892419ddbfe49287acfeac2522724), [`629f9e9`](https://github.com/mastra-ai/mastra/commit/629f9e9a7e56aa8f129515a3923c5813298790c7), [`25168fb`](https://github.com/mastra-ai/mastra/commit/25168fb9c1de9db7f8171df4f58ceb842c53aa29), [`ab34b5a`](https://github.com/mastra-ai/mastra/commit/ab34b5a2191b8e4353df1dbf7b9155e7d6628d79), [`5fb6c2a`](https://github.com/mastra-ai/mastra/commit/5fb6c2a95c1843cc231704b91354311fc1f34a71), [`2b0f355`](https://github.com/mastra-ai/mastra/commit/2b0f3553be3e9e5524da539a66e5cf82668440a4), [`711580e`](https://github.com/mastra-ai/mastra/commit/711580eeea6de34da1203b0a5d5a2b3589d38156), [`394f0cf`](https://github.com/mastra-ai/mastra/commit/394f0cfc31e6b4d801219fdef2e9cc69e5bc8682), [`b2deb29`](https://github.com/mastra-ai/mastra/commit/b2deb29412b300c868655b5840463614fbb7962d), [`66644be`](https://github.com/mastra-ai/mastra/commit/66644beac1aa560f0e417956ff007c89341dc382), [`e109607`](https://github.com/mastra-ai/mastra/commit/e10960749251e34d46b480a20648c490fd30381b), [`310b953`](https://github.com/mastra-ai/mastra/commit/310b95345f302dcd5ba3ed862bdc96f059d44122), [`3d7f709`](https://github.com/mastra-ai/mastra/commit/3d7f709b615e588050bb6283c4ee5cfe2978cbde), [`48a42f1`](https://github.com/mastra-ai/mastra/commit/48a42f114a4006a95e0b7a1b5ad1a24815a175c2), [`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006), [`2c83efc`](https://github.com/mastra-ai/mastra/commit/2c83efc4482b3efe50830e3b8b4ba9a8d219edff), [`282a10c`](https://github.com/mastra-ai/mastra/commit/282a10c9446e9922afe80e10e3770481c8ac8a28), [`43f0e1d`](https://github.com/mastra-ai/mastra/commit/43f0e1d5d5a74ba6fc746f2ad89ebe0c64777a7d), [`da0b9e2`](https://github.com/mastra-ai/mastra/commit/da0b9e2ba7ecc560213b426d6c097fe63946086e), [`282a10c`](https://github.com/mastra-ai/mastra/commit/282a10c9446e9922afe80e10e3770481c8ac8a28), [`04151c7`](https://github.com/mastra-ai/mastra/commit/04151c7dcea934b4fe9076708a23fac161195414), [`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006)]:
  - @mastra/core@1.31.0
  - @mastra/pg@1.9.4
  - @mastra/observability@1.11.0
  - @mastra/libsql@1.9.1

## 0.17.0-alpha.6

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.31.0-alpha.5

## 0.17.0-alpha.5

### Minor Changes

- Free-text answers to the `ask_user` tool can now span multiple lines. Press ([#15395](https://github.com/mastra-ai/mastra/pull/15395))
  `Shift+Enter` or `\+Enter` to insert a newline, `Enter` to submit, and `Esc`
  to cancel — long answers wrap inside the input box instead of scrolling
  horizontally off-screen, and the raw text (including indentation and trailing
  newlines) is forwarded to the agent intact.

  Slash-command prompts that take short answers (paths, names, yes/no, model
  picks) keep the existing single-line input, so muscle memory for those
  prompts is unchanged.

  Internally, this is opt-in via a new `multiline: true` flag on
  `AskQuestionInlineComponent` / `AskQuestionDialogComponent`. The flag also
  flows through `createStreaming` and `activate`, so the multiline editor is
  available everywhere those components are mounted.

## 0.16.3-alpha.4

### Patch Changes

- Updated dependencies [[`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006), [`04151c7`](https://github.com/mastra-ai/mastra/commit/04151c7dcea934b4fe9076708a23fac161195414), [`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006)]:
  - @mastra/core@1.31.0-alpha.4

## 0.16.3-alpha.3

### Patch Changes

- Updated dependencies [[`b2deb29`](https://github.com/mastra-ai/mastra/commit/b2deb29412b300c868655b5840463614fbb7962d), [`66644be`](https://github.com/mastra-ai/mastra/commit/66644beac1aa560f0e417956ff007c89341dc382), [`310b953`](https://github.com/mastra-ai/mastra/commit/310b95345f302dcd5ba3ed862bdc96f059d44122), [`43f0e1d`](https://github.com/mastra-ai/mastra/commit/43f0e1d5d5a74ba6fc746f2ad89ebe0c64777a7d), [`da0b9e2`](https://github.com/mastra-ai/mastra/commit/da0b9e2ba7ecc560213b426d6c097fe63946086e)]:
  - @mastra/core@1.31.0-alpha.3
  - @mastra/libsql@1.9.1-alpha.0
  - @mastra/pg@1.9.4-alpha.1

## 0.16.3-alpha.2

### Patch Changes

- Updated dependencies [[`2b0f355`](https://github.com/mastra-ai/mastra/commit/2b0f3553be3e9e5524da539a66e5cf82668440a4)]:
  - @mastra/core@1.31.0-alpha.2

## 0.16.3-alpha.1

### Patch Changes

- Updated dependencies [[`711580e`](https://github.com/mastra-ai/mastra/commit/711580eeea6de34da1203b0a5d5a2b3589d38156), [`e109607`](https://github.com/mastra-ai/mastra/commit/e10960749251e34d46b480a20648c490fd30381b)]:
  - @mastra/pg@1.9.4-alpha.0
  - @mastra/core@1.31.0-alpha.1

## 0.16.3-alpha.0

### Patch Changes

- Fixed user message box border misalignment when the first line of text fills the full width. The right border no longer extends past the top corner. ([#15993](https://github.com/mastra-ai/mastra/pull/15993))

- Updated dependencies [[`1723e09`](https://github.com/mastra-ai/mastra/commit/1723e099829892419ddbfe49287acfeac2522724), [`629f9e9`](https://github.com/mastra-ai/mastra/commit/629f9e9a7e56aa8f129515a3923c5813298790c7), [`25168fb`](https://github.com/mastra-ai/mastra/commit/25168fb9c1de9db7f8171df4f58ceb842c53aa29), [`ab34b5a`](https://github.com/mastra-ai/mastra/commit/ab34b5a2191b8e4353df1dbf7b9155e7d6628d79), [`5fb6c2a`](https://github.com/mastra-ai/mastra/commit/5fb6c2a95c1843cc231704b91354311fc1f34a71), [`394f0cf`](https://github.com/mastra-ai/mastra/commit/394f0cfc31e6b4d801219fdef2e9cc69e5bc8682), [`3d7f709`](https://github.com/mastra-ai/mastra/commit/3d7f709b615e588050bb6283c4ee5cfe2978cbde), [`48a42f1`](https://github.com/mastra-ai/mastra/commit/48a42f114a4006a95e0b7a1b5ad1a24815a175c2), [`2c83efc`](https://github.com/mastra-ai/mastra/commit/2c83efc4482b3efe50830e3b8b4ba9a8d219edff), [`282a10c`](https://github.com/mastra-ai/mastra/commit/282a10c9446e9922afe80e10e3770481c8ac8a28), [`282a10c`](https://github.com/mastra-ai/mastra/commit/282a10c9446e9922afe80e10e3770481c8ac8a28)]:
  - @mastra/core@1.31.0-alpha.0
  - @mastra/observability@1.11.0-alpha.0

## 0.16.2

### Patch Changes

- Show user message in TUI immediately before async work (thread creation, hooks, sending) for instant feedback regardless of GC pressure or I/O delays ([#15942](https://github.com/mastra-ai/mastra/pull/15942))

- Added changelog display to the update prompt. When a new version is available, the update screen now shows a summary of what's changed, fetched from the published npm package's CHANGELOG.md. ([#15924](https://github.com/mastra-ai/mastra/pull/15924))

- Updated dependencies [[`920c757`](https://github.com/mastra-ai/mastra/commit/920c75799c6bd71787d86deaf654a35af4c839ca), [`d587199`](https://github.com/mastra-ai/mastra/commit/d5871993c0371bde2b0717d6b47194755baa1443), [`1fe2533`](https://github.com/mastra-ai/mastra/commit/1fe2533c4382ca6858aac7c4b63e888c2eac6541), [`f8694b6`](https://github.com/mastra-ai/mastra/commit/f8694b6fa0b7a5cde71d794c3bbef4957c55bcb8), [`496e11d`](https://github.com/mastra-ai/mastra/commit/496e11d5b3c65d3a58e791de958554009cbd2eda), [`4b2e4f3`](https://github.com/mastra-ai/mastra/commit/4b2e4f3bc9f5a63dcbfccfa54f9474340c3cea58)]:
  - @mastra/core@1.30.0
  - @mastra/observability@1.10.3
  - @mastra/memory@1.17.4

## 0.16.2-alpha.1

### Patch Changes

- Updated dependencies [[`920c757`](https://github.com/mastra-ai/mastra/commit/920c75799c6bd71787d86deaf654a35af4c839ca), [`1fe2533`](https://github.com/mastra-ai/mastra/commit/1fe2533c4382ca6858aac7c4b63e888c2eac6541), [`f8694b6`](https://github.com/mastra-ai/mastra/commit/f8694b6fa0b7a5cde71d794c3bbef4957c55bcb8), [`496e11d`](https://github.com/mastra-ai/mastra/commit/496e11d5b3c65d3a58e791de958554009cbd2eda)]:
  - @mastra/core@1.30.0-alpha.1
  - @mastra/observability@1.10.3-alpha.0

## 0.16.2-alpha.0

### Patch Changes

- Show user message in TUI immediately before async work (thread creation, hooks, sending) for instant feedback regardless of GC pressure or I/O delays ([#15942](https://github.com/mastra-ai/mastra/pull/15942))

- Added changelog display to the update prompt. When a new version is available, the update screen now shows a summary of what's changed, fetched from the published npm package's CHANGELOG.md. ([#15924](https://github.com/mastra-ai/mastra/pull/15924))

- Updated dependencies [[`d587199`](https://github.com/mastra-ai/mastra/commit/d5871993c0371bde2b0717d6b47194755baa1443), [`4b2e4f3`](https://github.com/mastra-ai/mastra/commit/4b2e4f3bc9f5a63dcbfccfa54f9474340c3cea58)]:
  - @mastra/core@1.29.2-alpha.0
  - @mastra/memory@1.17.4-alpha.0

## 0.16.1

### Patch Changes

- Added common binary availability to the Mastra Code environment prompt. ([#15820](https://github.com/mastra-ai/mastra/pull/15820))

- dependencies updates: ([#15770](https://github.com/mastra-ai/mastra/pull/15770))
  - Updated dependency [`@ai-sdk/anthropic@^3.0.71` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/3.0.71) (from `^3.0.58`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai@^3.0.53` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai/v/3.0.53) (from `^3.0.41`, in `dependencies`)
  - Updated dependency [`ai@^6.0.168` ↗︎](https://www.npmjs.com/package/ai/v/6.0.168) (from `^6.0.116`, in `dependencies`)
- Updated dependencies [[`808df1b`](https://github.com/mastra-ai/mastra/commit/808df1b39358b5f10b7317107e42b1fda7c87185), [`6db978c`](https://github.com/mastra-ai/mastra/commit/6db978c42e94e75540a504f7230086f0b5cd35f9), [`95b001f`](https://github.com/mastra-ai/mastra/commit/95b001f750af6947ad9d174cd47abffc776663a5), [`512a013`](https://github.com/mastra-ai/mastra/commit/512a013f285aa9c0aa8f08a35b2ce09f9938b017), [`e9becde`](https://github.com/mastra-ai/mastra/commit/e9becdeed9176b9f8392e557bde12b933f99cf7a), [`1d7d50f`](https://github.com/mastra-ai/mastra/commit/1d7d50f0cf29449c17758cd9a9ad7f975f2c6fcc), [`703a443`](https://github.com/mastra-ai/mastra/commit/703a44390c587d9c0b8ae94ec4edd8afb2a74044), [`808df1b`](https://github.com/mastra-ai/mastra/commit/808df1b39358b5f10b7317107e42b1fda7c87185)]:
  - @mastra/observability@1.10.2
  - @mastra/core@1.29.1
  - @mastra/memory@1.17.3
  - @mastra/pg@1.9.3

## 0.16.1-alpha.3

### Patch Changes

- Updated dependencies [[`512a013`](https://github.com/mastra-ai/mastra/commit/512a013f285aa9c0aa8f08a35b2ce09f9938b017), [`e9becde`](https://github.com/mastra-ai/mastra/commit/e9becdeed9176b9f8392e557bde12b933f99cf7a)]:
  - @mastra/core@1.29.1-alpha.2

## 0.16.1-alpha.2

### Patch Changes

- dependencies updates: ([#15770](https://github.com/mastra-ai/mastra/pull/15770))
  - Updated dependency [`@ai-sdk/anthropic@^3.0.71` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/3.0.71) (from `^3.0.58`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai@^3.0.53` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai/v/3.0.53) (from `^3.0.41`, in `dependencies`)
  - Updated dependency [`ai@^6.0.168` ↗︎](https://www.npmjs.com/package/ai/v/6.0.168) (from `^6.0.116`, in `dependencies`)
- Updated dependencies [[`808df1b`](https://github.com/mastra-ai/mastra/commit/808df1b39358b5f10b7317107e42b1fda7c87185), [`703a443`](https://github.com/mastra-ai/mastra/commit/703a44390c587d9c0b8ae94ec4edd8afb2a74044), [`808df1b`](https://github.com/mastra-ai/mastra/commit/808df1b39358b5f10b7317107e42b1fda7c87185)]:
  - @mastra/observability@1.10.2-alpha.0
  - @mastra/core@1.29.1-alpha.1

## 0.16.1-alpha.1

### Patch Changes

- Added common binary availability to the Mastra Code environment prompt. ([#15820](https://github.com/mastra-ai/mastra/pull/15820))

- Updated dependencies [[`95b001f`](https://github.com/mastra-ai/mastra/commit/95b001f750af6947ad9d174cd47abffc776663a5)]:
  - @mastra/memory@1.17.3-alpha.0

## 0.16.1-alpha.0

### Patch Changes

- Updated dependencies [[`6db978c`](https://github.com/mastra-ai/mastra/commit/6db978c42e94e75540a504f7230086f0b5cd35f9), [`1d7d50f`](https://github.com/mastra-ai/mastra/commit/1d7d50f0cf29449c17758cd9a9ad7f975f2c6fcc)]:
  - @mastra/core@1.29.1-alpha.0
  - @mastra/pg@1.9.3-alpha.0

## 0.16.0

### Minor Changes

- Added evals system for MastraCode with live scorers that run automatically during sessions. ([#15642](https://github.com/mastra-ai/mastra/pull/15642))

  **Live scorers** grade outcomes and efficiency:
  - **Outcome scorer** — checks build/test pass status, tool error rates, stuck loops, regressions, and autonomy
  - **Efficiency scorer** — measures redundancy, turn count, retry efficiency, and read-before-edit patterns

  **New TUI command:**
  - `/feedback` — submit thumbs up/down and comments on traces, routed through the observability event bus so feedback reaches cloud exporters even when DuckDB is locked. Feedback is attributed to the user's git display name.

  **Automatic error feedback** — non-retryable stream errors automatically emit a thumbs-down feedback event with the error message, enabling error tracking in the cloud dashboard without manual intervention.

  **New TUI command:**
  - `/observability` — configure per-resource cloud observability project ID and access token. Credentials are stored securely in `auth.json` (0600 permissions) and project IDs in `settings.json`. No environment variables required.

  **Enriched span metadata** — agent run spans now capture model configuration, agent settings, OM settings, and project context for filtering and analysis in the cloud dashboard.

### Patch Changes

- Added a stream error retry processor with OpenAI Responses stream error matching. ([#15760](https://github.com/mastra-ai/mastra/pull/15760))

- Enable ProviderHistoryCompat error processor by default in mastracode ([#15730](https://github.com/mastra-ai/mastra/pull/15730))

- Fixed task lists, active plans, and sandbox paths leaking across threads. These per-thread state values are now properly cleared when switching threads, creating new threads, cloning threads, or using the /new command. ([#15749](https://github.com/mastra-ai/mastra/pull/15749))

- Forked subagents now inherit the parent agent's toolsets (so harness-injected tools like `ask_user`, `submit_plan`, and user-configured harness tools remain available inside a fork). The `subagent` tool entry is kept in the inherited toolset with its id, description, and schemas unchanged so the LLM request prefix stays byte-identical to the parent's and the prompt cache continues to hit; recursive forking is blocked at the runtime layer by replacing only the tool's `execute` with a stub that returns a "tool unavailable inside a forked subagent" message. Forked runs allow follow-up steps so the model can recover and answer directly if it accidentally calls that stub. Fork threads are tagged with `metadata.forkedSubagent: true` and `metadata.parentThreadId`, and `Harness.listThreads()` hides them by default so they don't surface in user-facing thread pickers; pass `includeForkedSubagents: true` to opt back in for admin/debug tooling. ([#15695](https://github.com/mastra-ai/mastra/pull/15695))

  Mastra Code now renders forked subagent footers as `subagent fork <parent model id>`, including persisted history reloaded after the live event metadata is gone.

- Updated Mastra Code's built-in OpenAI pack to use GPT-5.5 for plan and build mode, and added GPT-5.5-specific prompt guidance. ([#15759](https://github.com/mastra-ai/mastra/pull/15759))

- Allow typing a custom model string in `/om` (Observational Memory settings). The observer and reflector model pickers now use the same picker as `/models` — type a model id like `deepseek/deepseek-v4-flash` to use it directly if it's not in the list. ([#15703](https://github.com/mastra-ai/mastra/pull/15703))

  Observer and reflector model overrides are now persisted independently — changing one in `/om` no longer overwrites the other. Legacy `omModelOverride` is preserved as a shared fallback for settings files written before this change.

- Updated dependencies [[`28caa5b`](https://github.com/mastra-ai/mastra/commit/28caa5b032358545af2589ed90636eccb4dd9d2f), [`c1ae974`](https://github.com/mastra-ai/mastra/commit/c1ae97491f6e57378ce880c3a397778c42adcdf1), [`b510d36`](https://github.com/mastra-ai/mastra/commit/b510d368f73dab6be2e2c2bc99035aaef1fb7d7a), [`10e1c9a`](https://github.com/mastra-ai/mastra/commit/10e1c9a6a99c14eb055d0f409b603e07af827e68), [`13b4d7c`](https://github.com/mastra-ai/mastra/commit/13b4d7c16de34dff9095d1cd80f22f544b6cfe75), [`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3), [`c04417b`](https://github.com/mastra-ai/mastra/commit/c04417ba0a2e4ded66da4352331ef29cd4bd1d79), [`cf25a03`](https://github.com/mastra-ai/mastra/commit/cf25a03132164b9dc1e5dccf7394824e33007c51), [`8a71261`](https://github.com/mastra-ai/mastra/commit/8a71261e3954ae617c6f8e25767b951f99438ab2), [`9e973b0`](https://github.com/mastra-ai/mastra/commit/9e973b010dacfa15ac82b0072897319f5234b90a), [`dd934a0`](https://github.com/mastra-ai/mastra/commit/dd934a0982ce0f78712fbd559e4f2410bf594b39), [`ba6b0c5`](https://github.com/mastra-ai/mastra/commit/ba6b0c51bfce358554fd33c7f2bcd5593633f2ff), [`a6dac0a`](https://github.com/mastra-ai/mastra/commit/a6dac0a40c7181161b1add4e8534f962bcbc9aa7), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`6c8c6c7`](https://github.com/mastra-ai/mastra/commit/6c8c6c71518394321a4692614aa4b11f3bb0a343), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`7d056b6`](https://github.com/mastra-ai/mastra/commit/7d056b6ecf603cacaa0f663ff1df025ed885b6c1), [`9cef83b`](https://github.com/mastra-ai/mastra/commit/9cef83b8a642b8098747772921e3523b492bafbc), [`cf25a03`](https://github.com/mastra-ai/mastra/commit/cf25a03132164b9dc1e5dccf7394824e33007c51), [`d30e215`](https://github.com/mastra-ai/mastra/commit/d30e2156c746bc9fd791745cec1cc24377b66789), [`021a60f`](https://github.com/mastra-ai/mastra/commit/021a60f1f3e0135a70ef23c58be7a9b3aaffe6b4), [`73f2809`](https://github.com/mastra-ai/mastra/commit/73f2809721db24e98cdf122539652a455211b450), [`aedeea4`](https://github.com/mastra-ai/mastra/commit/aedeea48a94f728323f040478775076b9574be50), [`26f1f94`](https://github.com/mastra-ai/mastra/commit/26f1f9490574b864ba1ecedf2c9632e0767a23bd), [`8126d86`](https://github.com/mastra-ai/mastra/commit/8126d8638411eacfafdc29036ac998e8757ea66f), [`8c39f81`](https://github.com/mastra-ai/mastra/commit/8c39f815c7d06f2cd11bb099a72805a20f2ab755), [`73b45fa`](https://github.com/mastra-ai/mastra/commit/73b45facdef4fbcb8af710c50f0646f18619dbaa), [`ae97520`](https://github.com/mastra-ai/mastra/commit/ae975206fdb0f6ef03c4d5bf94f7dc7c3f706c02), [`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3), [`441670a`](https://github.com/mastra-ai/mastra/commit/441670a02c9dc7731c52674f55481e7848a84523)]:
  - @mastra/core@1.29.0
  - @mastra/mcp@1.6.0
  - @mastra/observability@1.10.1
  - @mastra/memory@1.17.2

## 0.16.0-alpha.6

### Patch Changes

- Added a stream error retry processor with OpenAI Responses stream error matching. ([#15760](https://github.com/mastra-ai/mastra/pull/15760))

- Forked subagents now inherit the parent agent's toolsets (so harness-injected tools like `ask_user`, `submit_plan`, and user-configured harness tools remain available inside a fork). The `subagent` tool entry is kept in the inherited toolset with its id, description, and schemas unchanged so the LLM request prefix stays byte-identical to the parent's and the prompt cache continues to hit; recursive forking is blocked at the runtime layer by replacing only the tool's `execute` with a stub that returns a "tool unavailable inside a forked subagent" message. Forked runs allow follow-up steps so the model can recover and answer directly if it accidentally calls that stub. Fork threads are tagged with `metadata.forkedSubagent: true` and `metadata.parentThreadId`, and `Harness.listThreads()` hides them by default so they don't surface in user-facing thread pickers; pass `includeForkedSubagents: true` to opt back in for admin/debug tooling. ([#15695](https://github.com/mastra-ai/mastra/pull/15695))

  Mastra Code now renders forked subagent footers as `subagent fork <parent model id>`, including persisted history reloaded after the live event metadata is gone.

- Updated Mastra Code's built-in OpenAI pack to use GPT-5.5 for plan and build mode, and added GPT-5.5-specific prompt guidance. ([#15759](https://github.com/mastra-ai/mastra/pull/15759))

- Updated dependencies [[`c1ae974`](https://github.com/mastra-ai/mastra/commit/c1ae97491f6e57378ce880c3a397778c42adcdf1), [`10e1c9a`](https://github.com/mastra-ai/mastra/commit/10e1c9a6a99c14eb055d0f409b603e07af827e68), [`13b4d7c`](https://github.com/mastra-ai/mastra/commit/13b4d7c16de34dff9095d1cd80f22f544b6cfe75), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`6c8c6c7`](https://github.com/mastra-ai/mastra/commit/6c8c6c71518394321a4692614aa4b11f3bb0a343), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`ec4cb26`](https://github.com/mastra-ai/mastra/commit/ec4cb26919972eb2031fea510f8f013e1d5b7ee2), [`8c39f81`](https://github.com/mastra-ai/mastra/commit/8c39f815c7d06f2cd11bb099a72805a20f2ab755)]:
  - @mastra/core@1.29.0-alpha.6
  - @mastra/mcp@1.6.0-alpha.0
  - @mastra/memory@1.17.2-alpha.0

## 0.16.0-alpha.5

### Patch Changes

- Updated dependencies [[`28caa5b`](https://github.com/mastra-ai/mastra/commit/28caa5b032358545af2589ed90636eccb4dd9d2f), [`7d056b6`](https://github.com/mastra-ai/mastra/commit/7d056b6ecf603cacaa0f663ff1df025ed885b6c1), [`26f1f94`](https://github.com/mastra-ai/mastra/commit/26f1f9490574b864ba1ecedf2c9632e0767a23bd)]:
  - @mastra/core@1.29.0-alpha.5

## 0.16.0-alpha.4

### Patch Changes

- Updated dependencies [[`8a71261`](https://github.com/mastra-ai/mastra/commit/8a71261e3954ae617c6f8e25767b951f99438ab2), [`021a60f`](https://github.com/mastra-ai/mastra/commit/021a60f1f3e0135a70ef23c58be7a9b3aaffe6b4)]:
  - @mastra/core@1.29.0-alpha.4

## 0.16.0-alpha.3

### Minor Changes

- Added evals system for MastraCode with live scorers that run automatically during sessions. ([#15642](https://github.com/mastra-ai/mastra/pull/15642))

  **Live scorers** grade outcomes and efficiency:
  - **Outcome scorer** — checks build/test pass status, tool error rates, stuck loops, regressions, and autonomy
  - **Efficiency scorer** — measures redundancy, turn count, retry efficiency, and read-before-edit patterns

  **New TUI command:**
  - `/feedback` — submit thumbs up/down and comments on traces, routed through the observability event bus so feedback reaches cloud exporters even when DuckDB is locked. Feedback is attributed to the user's git display name.

  **Automatic error feedback** — non-retryable stream errors automatically emit a thumbs-down feedback event with the error message, enabling error tracking in the cloud dashboard without manual intervention.

  **New TUI command:**
  - `/observability` — configure per-resource cloud observability project ID and access token. Credentials are stored securely in `auth.json` (0600 permissions) and project IDs in `settings.json`. No environment variables required.

  **Enriched span metadata** — agent run spans now capture model configuration, agent settings, OM settings, and project context for filtering and analysis in the cloud dashboard.

### Patch Changes

- Updated dependencies [[`c04417b`](https://github.com/mastra-ai/mastra/commit/c04417ba0a2e4ded66da4352331ef29cd4bd1d79), [`cf25a03`](https://github.com/mastra-ai/mastra/commit/cf25a03132164b9dc1e5dccf7394824e33007c51), [`ba6b0c5`](https://github.com/mastra-ai/mastra/commit/ba6b0c51bfce358554fd33c7f2bcd5593633f2ff), [`cf25a03`](https://github.com/mastra-ai/mastra/commit/cf25a03132164b9dc1e5dccf7394824e33007c51)]:
  - @mastra/core@1.29.0-alpha.3
  - @mastra/observability@1.10.1-alpha.0

## 0.15.3-alpha.2

### Patch Changes

- Updated dependencies [[`9e973b0`](https://github.com/mastra-ai/mastra/commit/9e973b010dacfa15ac82b0072897319f5234b90a), [`dd934a0`](https://github.com/mastra-ai/mastra/commit/dd934a0982ce0f78712fbd559e4f2410bf594b39), [`73f2809`](https://github.com/mastra-ai/mastra/commit/73f2809721db24e98cdf122539652a455211b450), [`aedeea4`](https://github.com/mastra-ai/mastra/commit/aedeea48a94f728323f040478775076b9574be50), [`8126d86`](https://github.com/mastra-ai/mastra/commit/8126d8638411eacfafdc29036ac998e8757ea66f), [`ae97520`](https://github.com/mastra-ai/mastra/commit/ae975206fdb0f6ef03c4d5bf94f7dc7c3f706c02), [`441670a`](https://github.com/mastra-ai/mastra/commit/441670a02c9dc7731c52674f55481e7848a84523)]:
  - @mastra/core@1.29.0-alpha.2

## 0.15.3-alpha.1

### Patch Changes

- Enable ProviderHistoryCompat error processor by default in mastracode ([#15730](https://github.com/mastra-ai/mastra/pull/15730))

- Fixed task lists, active plans, and sandbox paths leaking across threads. These per-thread state values are now properly cleared when switching threads, creating new threads, cloning threads, or using the /new command. ([#15749](https://github.com/mastra-ai/mastra/pull/15749))

- Allow typing a custom model string in `/om` (Observational Memory settings). The observer and reflector model pickers now use the same picker as `/models` — type a model id like `deepseek/deepseek-v4-flash` to use it directly if it's not in the list. ([#15703](https://github.com/mastra-ai/mastra/pull/15703))

  Observer and reflector model overrides are now persisted independently — changing one in `/om` no longer overwrites the other. Legacy `omModelOverride` is preserved as a shared fallback for settings files written before this change.

- Updated dependencies [[`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3), [`a6dac0a`](https://github.com/mastra-ai/mastra/commit/a6dac0a40c7181161b1add4e8534f962bcbc9aa7), [`9cef83b`](https://github.com/mastra-ai/mastra/commit/9cef83b8a642b8098747772921e3523b492bafbc), [`d30e215`](https://github.com/mastra-ai/mastra/commit/d30e2156c746bc9fd791745cec1cc24377b66789), [`73b45fa`](https://github.com/mastra-ai/mastra/commit/73b45facdef4fbcb8af710c50f0646f18619dbaa), [`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3)]:
  - @mastra/core@1.29.0-alpha.1

## 0.15.3-alpha.0

### Patch Changes

- Updated dependencies [[`b510d36`](https://github.com/mastra-ai/mastra/commit/b510d368f73dab6be2e2c2bc99035aaef1fb7d7a)]:
  - @mastra/core@1.29.0-alpha.0

## 0.15.2

### Patch Changes

- Fixed custom slash commands to create the pending thread before sending the first prompt so the initial exchange stays in the same conversation. ([#15678](https://github.com/mastra-ai/mastra/pull/15678))

- Updated dependencies [[`733bf53`](https://github.com/mastra-ai/mastra/commit/733bf53d9352aedd3ef38c3d501edb275b65b43c), [`a48adc3`](https://github.com/mastra-ai/mastra/commit/a48adc387375d1ff75f8526525c809a8fdea46df), [`5405b3b`](https://github.com/mastra-ai/mastra/commit/5405b3b35325c5b8fb34fc7ac109bd2feb7bb6fe), [`45e29cb`](https://github.com/mastra-ai/mastra/commit/45e29cb5b5737f3083eb3852db02b944b9cf37ed), [`750b4d3`](https://github.com/mastra-ai/mastra/commit/750b4d3d8231f92e769b2c485921ac5a8ca639b9), [`c321127`](https://github.com/mastra-ai/mastra/commit/c3211275fc195de9ad1ead2746b354beb8eae6e8), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1), [`696694e`](https://github.com/mastra-ai/mastra/commit/696694e00f29241a25dd1a1b749afa06c3a626b4), [`b084a80`](https://github.com/mastra-ai/mastra/commit/b084a800db0f82d62e1fc3d6e3e3480da1ba5a53), [`82b7a96`](https://github.com/mastra-ai/mastra/commit/82b7a964169636c1d1e0c694fc892a213b0179d5), [`e20a3d2`](https://github.com/mastra-ai/mastra/commit/e20a3d2cda9b94ca6625519da2e6492c335bd009), [`df97812`](https://github.com/mastra-ai/mastra/commit/df97812bd949dcafeb074b80ecab501724b49c3b), [`1422165`](https://github.com/mastra-ai/mastra/commit/14221652c8cd58c4a0be55e81bf05a5096bbb7d9), [`8bbe360`](https://github.com/mastra-ai/mastra/commit/8bbe36042af7fc4be0244dffd8913f6795179421), [`f6b8ba8`](https://github.com/mastra-ai/mastra/commit/f6b8ba8dbf533b7a8db90c72b6805ddc804a3a72), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1)]:
  - @mastra/core@1.28.0
  - @mastra/agent-browser@0.2.1
  - @mastra/stagehand@0.2.1
  - @mastra/memory@1.17.1
  - @mastra/mcp@1.5.2

## 0.15.2-alpha.2

### Patch Changes

- Updated dependencies [[`45e29cb`](https://github.com/mastra-ai/mastra/commit/45e29cb5b5737f3083eb3852db02b944b9cf37ed), [`696694e`](https://github.com/mastra-ai/mastra/commit/696694e00f29241a25dd1a1b749afa06c3a626b4)]:
  - @mastra/core@1.28.0-alpha.2

## 0.15.2-alpha.1

### Patch Changes

- Updated dependencies [[`a48adc3`](https://github.com/mastra-ai/mastra/commit/a48adc387375d1ff75f8526525c809a8fdea46df), [`750b4d3`](https://github.com/mastra-ai/mastra/commit/750b4d3d8231f92e769b2c485921ac5a8ca639b9)]:
  - @mastra/agent-browser@0.2.1-alpha.1
  - @mastra/stagehand@0.2.1-alpha.0
  - @mastra/core@1.28.0-alpha.1
  - @mastra/memory@1.17.1-alpha.0

## 0.15.2-alpha.0

### Patch Changes

- Fixed custom slash commands to create the pending thread before sending the first prompt so the initial exchange stays in the same conversation. ([#15678](https://github.com/mastra-ai/mastra/pull/15678))

- Updated dependencies [[`733bf53`](https://github.com/mastra-ai/mastra/commit/733bf53d9352aedd3ef38c3d501edb275b65b43c), [`5405b3b`](https://github.com/mastra-ai/mastra/commit/5405b3b35325c5b8fb34fc7ac109bd2feb7bb6fe), [`c321127`](https://github.com/mastra-ai/mastra/commit/c3211275fc195de9ad1ead2746b354beb8eae6e8), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1), [`b084a80`](https://github.com/mastra-ai/mastra/commit/b084a800db0f82d62e1fc3d6e3e3480da1ba5a53), [`82b7a96`](https://github.com/mastra-ai/mastra/commit/82b7a964169636c1d1e0c694fc892a213b0179d5), [`df97812`](https://github.com/mastra-ai/mastra/commit/df97812bd949dcafeb074b80ecab501724b49c3b), [`1422165`](https://github.com/mastra-ai/mastra/commit/14221652c8cd58c4a0be55e81bf05a5096bbb7d9), [`8bbe360`](https://github.com/mastra-ai/mastra/commit/8bbe36042af7fc4be0244dffd8913f6795179421), [`f6b8ba8`](https://github.com/mastra-ai/mastra/commit/f6b8ba8dbf533b7a8db90c72b6805ddc804a3a72), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1)]:
  - @mastra/core@1.28.0-alpha.0
  - @mastra/agent-browser@0.2.1-alpha.0

## 0.15.1

### Patch Changes

- Added opt-in temporal-gap markers for observational memory. When enabled via `observationalMemory.temporalMarkers: true`, the agent receives a `<system-reminder type="temporal-gap">` before any user message that arrives more than 10 minutes after the previous one, so it can anchor responses in real elapsed time. Markers are persisted, surfaced to the observer, and rendered by the MastraCode TUI on reload. ([#15605](https://github.com/mastra-ai/mastra/pull/15605))

- Improved model ID display in the Mastra Code TUI status line. Fireworks model IDs are now shown in compact form (e.g. fireworks/kimi-k2.6 instead of the full fireworks-ai/accounts/fireworks/models/... path). Version separators in model names are also normalized (e.g. kimi-k2p6 is displayed as kimi-k2.6). ([#15631](https://github.com/mastra-ai/mastra/pull/15631))

- Updated dependencies [[`f112db1`](https://github.com/mastra-ai/mastra/commit/f112db179557ae9b5a0f1d25dc47f928d7d61cd9), [`21d9706`](https://github.com/mastra-ai/mastra/commit/21d970604d89eee970cbf8013d26d7551aff6ea5), [`0a0aa94`](https://github.com/mastra-ai/mastra/commit/0a0aa94729592e99885af2efb90c56aaada62247), [`ed07df3`](https://github.com/mastra-ai/mastra/commit/ed07df32a9d539c8261e892fc1bade783f5b41a6), [`96f6fb2`](https://github.com/mastra-ai/mastra/commit/96f6fb2dc9ed0980091e66f727542394ba5b300d), [`01a7d51`](https://github.com/mastra-ai/mastra/commit/01a7d513493d21562f677f98550f7ceb165ba78c), [`6e9ab07`](https://github.com/mastra-ai/mastra/commit/6e9ab07b7120e0f4ed1e117c45db0f94840f4afd)]:
  - @mastra/core@1.27.0
  - @mastra/tavily@1.0.1
  - @mastra/memory@1.17.0

## 0.15.1-alpha.2

### Patch Changes

- Updated dependencies [[`ed07df3`](https://github.com/mastra-ai/mastra/commit/ed07df32a9d539c8261e892fc1bade783f5b41a6)]:
  - @mastra/core@1.27.0-alpha.2

## 0.15.1-alpha.1

### Patch Changes

- Added opt-in temporal-gap markers for observational memory. When enabled via `observationalMemory.temporalMarkers: true`, the agent receives a `<system-reminder type="temporal-gap">` before any user message that arrives more than 10 minutes after the previous one, so it can anchor responses in real elapsed time. Markers are persisted, surfaced to the observer, and rendered by the MastraCode TUI on reload. ([#15605](https://github.com/mastra-ai/mastra/pull/15605))

- Improved model ID display in the Mastra Code TUI status line. Fireworks model IDs are now shown in compact form (e.g. fireworks/kimi-k2.6 instead of the full fireworks-ai/accounts/fireworks/models/... path). Version separators in model names are also normalized (e.g. kimi-k2p6 is displayed as kimi-k2.6). ([#15631](https://github.com/mastra-ai/mastra/pull/15631))

- Updated dependencies [[`0a0aa94`](https://github.com/mastra-ai/mastra/commit/0a0aa94729592e99885af2efb90c56aaada62247), [`96f6fb2`](https://github.com/mastra-ai/mastra/commit/96f6fb2dc9ed0980091e66f727542394ba5b300d), [`01a7d51`](https://github.com/mastra-ai/mastra/commit/01a7d513493d21562f677f98550f7ceb165ba78c), [`6e9ab07`](https://github.com/mastra-ai/mastra/commit/6e9ab07b7120e0f4ed1e117c45db0f94840f4afd)]:
  - @mastra/core@1.27.0-alpha.1
  - @mastra/tavily@1.0.1-alpha.0
  - @mastra/memory@1.17.0-alpha.0

## 0.15.1-alpha.0

### Patch Changes

- Updated dependencies [[`f112db1`](https://github.com/mastra-ai/mastra/commit/f112db179557ae9b5a0f1d25dc47f928d7d61cd9), [`21d9706`](https://github.com/mastra-ai/mastra/commit/21d970604d89eee970cbf8013d26d7551aff6ea5)]:
  - @mastra/core@1.26.1-alpha.0

## 0.15.0

### Minor Changes

- Added `--output-format` flag to headless mode, accepting `text`, `json`, and `stream-json` for automation and CI use cases. Coexists with all existing headless flags. ([#15423](https://github.com/mastra-ai/mastra/pull/15423))

- Added share and import features for model packs. You can now share a custom model pack configuration by copying it to the clipboard, and import a shared pack from someone else using the new Import Pack option in the /models command. ([#15370](https://github.com/mastra-ai/mastra/pull/15370))

- Added `--model`, `--mode`, `--thinking-level`, and `--settings` CLI flags to headless mode for controlling model selection, execution mode, and thinking level without interactive TUI. Uses the same `settings.json` as the interactive TUI — pass `--settings <path>` for CI or other environments, or omit to use the default global settings. Added `settingsPath` option to `createMastraCode()` for programmatic use. ([#14909](https://github.com/mastra-ai/mastra/pull/14909))

- Added the `@mastra/tavily` integration with first-class Mastra tools for Tavily web search, extract, crawl, and map APIs, and migrated `mastracode`'s web search tools to use it. ([#15448](https://github.com/mastra-ai/mastra/pull/15448))

### Patch Changes

- Improved observational memory activation output in MastraCode. ([#15365](https://github.com/mastra-ai/mastra/pull/15365))

  **What changed**
  - Added a separate Observation TTL line when buffered context activates after inactivity
  - Removed repeated TTL text from each activation line so grouped activations are easier to scan

  This makes long idle-thread activations much easier to read in the terminal.

- Fix API key resolution to check stored key slot and env vars. ([#15483](https://github.com/mastra-ai/mastra/pull/15483))

  `getAnthropicApiKey()` and `getOpenAIApiKey()` now check `authStorage.getStoredApiKey()` and `process.env` in addition to the main credential slot. Fixes API keys becoming invisible to `resolveModel` after OAuth connect/disconnect cycles.

- Fixed the observational memory reflection activation label in MastraCode so it describes the actual change to the observation pool. ([#15462](https://github.com/mastra-ai/mastra/pull/15462))

  Reflection activations now render as `before → after obs tokens (-delta)` instead of implying that message tokens were removed. Observation activations still use the existing `-X msg tokens, +Y obs tokens` format.

- Fixed a security issue where several parsing and tracing paths could slow down on malformed or attacker-crafted input. Normal behavior is unchanged, and these packages now handle pathological input in linear time. ([#15566](https://github.com/mastra-ai/mastra/pull/15566))

- Updated the default Anthropic mode pack models. Users signed in with an Anthropic Max subscription now get `claude-opus-4-7` for `build` and `plan`, and API-key users get `claude-sonnet-4-6` for `build` and `plan`. The `fast` model is unchanged. ([#15458](https://github.com/mastra-ai/mastra/pull/15458))

- Improved observational memory activation output to show when a provider or model switch triggered buffered observation activation. ([#15420](https://github.com/mastra-ai/mastra/pull/15420))

- Updated dependencies [[`20f59b8`](https://github.com/mastra-ai/mastra/commit/20f59b876cf91199efbc49a0e36b391240708f08), [`aba393e`](https://github.com/mastra-ai/mastra/commit/aba393e2da7390c69b80e516a4f153cda6f09376), [`3d83d06`](https://github.com/mastra-ai/mastra/commit/3d83d06f776f00fb5f4163dddd32a030c5c20844), [`e2687a7`](https://github.com/mastra-ai/mastra/commit/e2687a7408790c384563816a9a28ed06735684c9), [`fdd54cf`](https://github.com/mastra-ai/mastra/commit/fdd54cf612a9af876e9fdd85e534454f6e7dd518), [`d63ffdb`](https://github.com/mastra-ai/mastra/commit/d63ffdbb2c11e76fe5ea45faab44bc15460f010c), [`6315317`](https://github.com/mastra-ai/mastra/commit/63153175fe9a7b224e5be7c209bbebc01dd9b0d5), [`a371ac5`](https://github.com/mastra-ai/mastra/commit/a371ac534aa1bb368a1acf9d8b313378dfdc787e), [`0474c2b`](https://github.com/mastra-ai/mastra/commit/0474c2b2e7c7e1ad8691dca031284841391ff1ef), [`f607106`](https://github.com/mastra-ai/mastra/commit/f607106854c6416c4a07d4082604b9f66d047221), [`0a5fa1d`](https://github.com/mastra-ai/mastra/commit/0a5fa1d3cb0583889d06687155f26fd7d2edc76c), [`7e0e63e`](https://github.com/mastra-ai/mastra/commit/7e0e63e2e485e84442351f4c7a79a424c83539dc), [`ea43e64`](https://github.com/mastra-ai/mastra/commit/ea43e646dd95d507694b6112b0bf1df22ad552b2), [`f607106`](https://github.com/mastra-ai/mastra/commit/f607106854c6416c4a07d4082604b9f66d047221), [`30456b6`](https://github.com/mastra-ai/mastra/commit/30456b6b08c8fd17e109dd093b73d93b65e83bc5), [`9d11a8c`](https://github.com/mastra-ai/mastra/commit/9d11a8c1c8924eb975a245a5884d40ca1b7e0491), [`3a347a9`](https://github.com/mastra-ai/mastra/commit/3a347a95c563df027d082bcc82ddc31b88410744), [`2ca2d23`](https://github.com/mastra-ai/mastra/commit/2ca2d23913dec4e6cb0fa8e8eecb1184af7ccd81), [`9d3b24b`](https://github.com/mastra-ai/mastra/commit/9d3b24b19407ae9c09586cf7766d38dc4dff4a69), [`7020c06`](https://github.com/mastra-ai/mastra/commit/7020c0690b199d9da337f0e805f16948e557922e), [`00d1b16`](https://github.com/mastra-ai/mastra/commit/00d1b16b401199cb294fa23f43336547db4dca9b), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`62919a6`](https://github.com/mastra-ai/mastra/commit/62919a6ee0fbf3779ad21a97b1ec6696515d5104), [`d246696`](https://github.com/mastra-ai/mastra/commit/d246696139a3144a5b21b042d41c532688e957e1), [`354f9ce`](https://github.com/mastra-ai/mastra/commit/354f9ce1ca6af2074b6a196a23f8ec30012dccca), [`16e34ca`](https://github.com/mastra-ai/mastra/commit/16e34caa98b9a114b17a6125e4e3fd87f169d0d0), [`7020c06`](https://github.com/mastra-ai/mastra/commit/7020c0690b199d9da337f0e805f16948e557922e), [`8786a61`](https://github.com/mastra-ai/mastra/commit/8786a61fa54ba265f85eeff9985ca39863d18bb6), [`9467ea8`](https://github.com/mastra-ai/mastra/commit/9467ea87695749a53dfc041576410ebf9ee7bb67), [`7338d94`](https://github.com/mastra-ai/mastra/commit/7338d949380cf68b095342e8e42610dc51d557c1), [`c80dc16`](https://github.com/mastra-ai/mastra/commit/c80dc16e113e6cc159f510ffde501ad4711b2189), [`af8a57e`](https://github.com/mastra-ai/mastra/commit/af8a57ed9ba9685ad8601d5b71ae3706da6222f9), [`d63ffdb`](https://github.com/mastra-ai/mastra/commit/d63ffdbb2c11e76fe5ea45faab44bc15460f010c), [`c79dde7`](https://github.com/mastra-ai/mastra/commit/c79dde70a89398301e9d46a901807f5892b10909), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`1bd5104`](https://github.com/mastra-ai/mastra/commit/1bd51048b6da93507276d6623e3fd96a9e1a8944), [`ad0d3e8`](https://github.com/mastra-ai/mastra/commit/ad0d3e80db7472a73e26d3516c04df0513c2c189), [`e9837b5`](https://github.com/mastra-ai/mastra/commit/e9837b53699e18711b09e0ca010a4106376f2653), [`c65aec3`](https://github.com/mastra-ai/mastra/commit/c65aec356cc037ee7c4b30ccea946807d4c4f443), [`8f1b280`](https://github.com/mastra-ai/mastra/commit/8f1b280b7fe6999ec654f160cb69c1a8719e7a57), [`92dcf02`](https://github.com/mastra-ai/mastra/commit/92dcf029294210ac91b090900c1a0555a425c57a), [`0fd90a2`](https://github.com/mastra-ai/mastra/commit/0fd90a215caf5fca8099c15a67ca03e4427747a3), [`0fd90a2`](https://github.com/mastra-ai/mastra/commit/0fd90a215caf5fca8099c15a67ca03e4427747a3), [`8fb2405`](https://github.com/mastra-ai/mastra/commit/8fb2405138f2d208b7962ad03f121ca25bcc28c5), [`12df98c`](https://github.com/mastra-ai/mastra/commit/12df98c4904643d9481f5c78f3bed443725b4c96)]:
  - @mastra/core@1.26.0
  - @mastra/pg@1.9.2
  - @mastra/libsql@1.9.0
  - @mastra/memory@1.16.0
  - @mastra/tavily@1.0.0
  - @mastra/mcp@1.5.1

## 0.15.0-alpha.13

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.26.0-alpha.13

## 0.15.0-alpha.12

### Minor Changes

- Added the `@mastra/tavily` integration with first-class Mastra tools for Tavily web search, extract, crawl, and map APIs, and migrated `mastracode`'s web search tools to use it. ([#15448](https://github.com/mastra-ai/mastra/pull/15448))

### Patch Changes

- Updated dependencies [[`a371ac5`](https://github.com/mastra-ai/mastra/commit/a371ac534aa1bb368a1acf9d8b313378dfdc787e), [`3a347a9`](https://github.com/mastra-ai/mastra/commit/3a347a95c563df027d082bcc82ddc31b88410744), [`2ca2d23`](https://github.com/mastra-ai/mastra/commit/2ca2d23913dec4e6cb0fa8e8eecb1184af7ccd81), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`c80dc16`](https://github.com/mastra-ai/mastra/commit/c80dc16e113e6cc159f510ffde501ad4711b2189), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e)]:
  - @mastra/core@1.26.0-alpha.12
  - @mastra/memory@1.16.0-alpha.4
  - @mastra/tavily@1.0.0-alpha.1

## 0.15.0-alpha.11

### Patch Changes

- Updated dependencies [[`20f59b8`](https://github.com/mastra-ai/mastra/commit/20f59b876cf91199efbc49a0e36b391240708f08), [`e2687a7`](https://github.com/mastra-ai/mastra/commit/e2687a7408790c384563816a9a28ed06735684c9), [`ad0d3e8`](https://github.com/mastra-ai/mastra/commit/ad0d3e80db7472a73e26d3516c04df0513c2c189), [`8f1b280`](https://github.com/mastra-ai/mastra/commit/8f1b280b7fe6999ec654f160cb69c1a8719e7a57), [`12df98c`](https://github.com/mastra-ai/mastra/commit/12df98c4904643d9481f5c78f3bed443725b4c96)]:
  - @mastra/core@1.26.0-alpha.11
  - @mastra/libsql@1.9.0-alpha.2
  - @mastra/pg@1.9.2-alpha.1

## 0.15.0-alpha.10

### Minor Changes

- Added `--output-format` flag to headless mode, accepting `text`, `json`, and `stream-json` for automation and CI use cases. Coexists with all existing headless flags. ([#15423](https://github.com/mastra-ai/mastra/pull/15423))

### Patch Changes

- Fixed a security issue where several parsing and tracing paths could slow down on malformed or attacker-crafted input. Normal behavior is unchanged, and these packages now handle pathological input in linear time. ([#15566](https://github.com/mastra-ai/mastra/pull/15566))

- Updated dependencies [[`aba393e`](https://github.com/mastra-ai/mastra/commit/aba393e2da7390c69b80e516a4f153cda6f09376), [`0a5fa1d`](https://github.com/mastra-ai/mastra/commit/0a5fa1d3cb0583889d06687155f26fd7d2edc76c), [`ea43e64`](https://github.com/mastra-ai/mastra/commit/ea43e646dd95d507694b6112b0bf1df22ad552b2), [`00d1b16`](https://github.com/mastra-ai/mastra/commit/00d1b16b401199cb294fa23f43336547db4dca9b), [`af8a57e`](https://github.com/mastra-ai/mastra/commit/af8a57ed9ba9685ad8601d5b71ae3706da6222f9)]:
  - @mastra/core@1.26.0-alpha.10
  - @mastra/memory@1.16.0-alpha.3

## 0.15.0-alpha.9

### Patch Changes

- Updated dependencies [[`16e34ca`](https://github.com/mastra-ai/mastra/commit/16e34caa98b9a114b17a6125e4e3fd87f169d0d0), [`c79dde7`](https://github.com/mastra-ai/mastra/commit/c79dde70a89398301e9d46a901807f5892b10909)]:
  - @mastra/core@1.26.0-alpha.9
  - @mastra/libsql@1.9.0-alpha.1

## 0.15.0-alpha.8

### Patch Changes

- Updated dependencies [[`1bd5104`](https://github.com/mastra-ai/mastra/commit/1bd51048b6da93507276d6623e3fd96a9e1a8944)]:
  - @mastra/core@1.26.0-alpha.8

## 0.15.0-alpha.7

### Patch Changes

- Fix API key resolution to check stored key slot and env vars. ([#15483](https://github.com/mastra-ai/mastra/pull/15483))

  `getAnthropicApiKey()` and `getOpenAIApiKey()` now check `authStorage.getStoredApiKey()` and `process.env` in addition to the main credential slot. Fixes API keys becoming invisible to `resolveModel` after OAuth connect/disconnect cycles.

- Updated dependencies [[`8786a61`](https://github.com/mastra-ai/mastra/commit/8786a61fa54ba265f85eeff9985ca39863d18bb6), [`8fb2405`](https://github.com/mastra-ai/mastra/commit/8fb2405138f2d208b7962ad03f121ca25bcc28c5)]:
  - @mastra/core@1.26.0-alpha.7

## 0.15.0-alpha.6

### Patch Changes

- Updated dependencies [[`6315317`](https://github.com/mastra-ai/mastra/commit/63153175fe9a7b224e5be7c209bbebc01dd9b0d5), [`9d3b24b`](https://github.com/mastra-ai/mastra/commit/9d3b24b19407ae9c09586cf7766d38dc4dff4a69)]:
  - @mastra/core@1.26.0-alpha.6

## 0.15.0-alpha.5

### Patch Changes

- Updated dependencies [[`92dcf02`](https://github.com/mastra-ai/mastra/commit/92dcf029294210ac91b090900c1a0555a425c57a)]:
  - @mastra/core@1.26.0-alpha.5

## 0.15.0-alpha.4

### Patch Changes

- Fixed the observational memory reflection activation label in MastraCode so it describes the actual change to the observation pool. ([#15462](https://github.com/mastra-ai/mastra/pull/15462))

  Reflection activations now render as `before → after obs tokens (-delta)` instead of implying that message tokens were removed. Observation activations still use the existing `-X msg tokens, +Y obs tokens` format.

- Updated the default Anthropic mode pack models. Users signed in with an Anthropic Max subscription now get `claude-opus-4-7` for `build` and `plan`, and API-key users get `claude-sonnet-4-6` for `build` and `plan`. The `fast` model is unchanged. ([#15458](https://github.com/mastra-ai/mastra/pull/15458))

- Improved observational memory activation output to show when a provider or model switch triggered buffered observation activation. ([#15420](https://github.com/mastra-ai/mastra/pull/15420))

- Updated dependencies [[`0474c2b`](https://github.com/mastra-ai/mastra/commit/0474c2b2e7c7e1ad8691dca031284841391ff1ef), [`f607106`](https://github.com/mastra-ai/mastra/commit/f607106854c6416c4a07d4082604b9f66d047221), [`f607106`](https://github.com/mastra-ai/mastra/commit/f607106854c6416c4a07d4082604b9f66d047221), [`62919a6`](https://github.com/mastra-ai/mastra/commit/62919a6ee0fbf3779ad21a97b1ec6696515d5104), [`0fd90a2`](https://github.com/mastra-ai/mastra/commit/0fd90a215caf5fca8099c15a67ca03e4427747a3), [`0fd90a2`](https://github.com/mastra-ai/mastra/commit/0fd90a215caf5fca8099c15a67ca03e4427747a3)]:
  - @mastra/core@1.26.0-alpha.4
  - @mastra/memory@1.16.0-alpha.2

## 0.15.0-alpha.3

### Patch Changes

- Updated dependencies [[`fdd54cf`](https://github.com/mastra-ai/mastra/commit/fdd54cf612a9af876e9fdd85e534454f6e7dd518), [`30456b6`](https://github.com/mastra-ai/mastra/commit/30456b6b08c8fd17e109dd093b73d93b65e83bc5), [`9d11a8c`](https://github.com/mastra-ai/mastra/commit/9d11a8c1c8924eb975a245a5884d40ca1b7e0491), [`d246696`](https://github.com/mastra-ai/mastra/commit/d246696139a3144a5b21b042d41c532688e957e1), [`354f9ce`](https://github.com/mastra-ai/mastra/commit/354f9ce1ca6af2074b6a196a23f8ec30012dccca), [`e9837b5`](https://github.com/mastra-ai/mastra/commit/e9837b53699e18711b09e0ca010a4106376f2653)]:
  - @mastra/core@1.26.0-alpha.3
  - @mastra/mcp@1.5.1-alpha.1
  - @mastra/memory@1.16.0-alpha.1

## 0.15.0-alpha.2

### Minor Changes

- Added `--model`, `--mode`, `--thinking-level`, and `--settings` CLI flags to headless mode for controlling model selection, execution mode, and thinking level without interactive TUI. Uses the same `settings.json` as the interactive TUI — pass `--settings <path>` for CI or other environments, or omit to use the default global settings. Added `settingsPath` option to `createMastraCode()` for programmatic use. ([#14909](https://github.com/mastra-ai/mastra/pull/14909))

### Patch Changes

- Improved observational memory activation output in MastraCode. ([#15365](https://github.com/mastra-ai/mastra/pull/15365))

  **What changed**
  - Added a separate Observation TTL line when buffered context activates after inactivity
  - Removed repeated TTL text from each activation line so grouped activations are easier to scan

  This makes long idle-thread activations much easier to read in the terminal.

- Updated dependencies [[`3d83d06`](https://github.com/mastra-ai/mastra/commit/3d83d06f776f00fb5f4163dddd32a030c5c20844), [`7e0e63e`](https://github.com/mastra-ai/mastra/commit/7e0e63e2e485e84442351f4c7a79a424c83539dc), [`9467ea8`](https://github.com/mastra-ai/mastra/commit/9467ea87695749a53dfc041576410ebf9ee7bb67), [`7338d94`](https://github.com/mastra-ai/mastra/commit/7338d949380cf68b095342e8e42610dc51d557c1), [`c65aec3`](https://github.com/mastra-ai/mastra/commit/c65aec356cc037ee7c4b30ccea946807d4c4f443)]:
  - @mastra/core@1.26.0-alpha.2
  - @mastra/memory@1.16.0-alpha.0
  - @mastra/mcp@1.5.1-alpha.1

## 0.15.0-alpha.1

### Patch Changes

- Updated dependencies [[`7020c06`](https://github.com/mastra-ai/mastra/commit/7020c0690b199d9da337f0e805f16948e557922e), [`7020c06`](https://github.com/mastra-ai/mastra/commit/7020c0690b199d9da337f0e805f16948e557922e)]:
  - @mastra/mcp@1.5.1-alpha.0
  - @mastra/core@1.25.1-alpha.1

## 0.15.0-alpha.0

### Minor Changes

- Added share and import features for model packs. You can now share a custom model pack configuration by copying it to the clipboard, and import a shared pack from someone else using the new Import Pack option in the /models command. ([#15370](https://github.com/mastra-ai/mastra/pull/15370))

### Patch Changes

- Updated dependencies [[`d63ffdb`](https://github.com/mastra-ai/mastra/commit/d63ffdbb2c11e76fe5ea45faab44bc15460f010c), [`d63ffdb`](https://github.com/mastra-ai/mastra/commit/d63ffdbb2c11e76fe5ea45faab44bc15460f010c)]:
  - @mastra/pg@1.9.2-alpha.0
  - @mastra/libsql@1.8.2-alpha.0
  - @mastra/core@1.25.1-alpha.0

## 0.14.0

### Minor Changes

- Added `/browser set` command for configuring browser profile, executable path, storage state, and CDP URL. Updated the interactive wizard with advanced options for custom browsers and CDP connections. ([#15194](https://github.com/mastra-ai/mastra/pull/15194))

- Added /api-keys command to manage API keys for model providers. You can add, update, or remove keys directly, or access it from the settings menu. ([#15014](https://github.com/mastra-ai/mastra/pull/15014))

### Patch Changes

- Fixed symlinked skill paths so workspace skills resolve consistently and allowed path checks work through both symlink and real paths. ([#15228](https://github.com/mastra-ai/mastra/pull/15228))

- Improved Mastra Code prompt guidance for autonomous decisions and blocked work. ([#15352](https://github.com/mastra-ai/mastra/pull/15352))

- Improved observational memory summaries to use caveman-style custom instructions for terser stored observations. ([#15359](https://github.com/mastra-ai/mastra/pull/15359))

- Updated dependencies [[`87df955`](https://github.com/mastra-ai/mastra/commit/87df955c028660c075873fd5d74af28233ce32eb), [`8687969`](https://github.com/mastra-ai/mastra/commit/86879696b80f87269bec34fd17fa377bce3a5892), [`8fad147`](https://github.com/mastra-ai/mastra/commit/8fad14759804179c8e080ce4d9dec6ef1a808b31), [`582644c`](https://github.com/mastra-ai/mastra/commit/582644c4a87f83b4f245a84d72b9e8590585012e), [`cbdf3e1`](https://github.com/mastra-ai/mastra/commit/cbdf3e12b3d0c30a6e5347be658e2009648c130a), [`8fe46d3`](https://github.com/mastra-ai/mastra/commit/8fe46d354027f3f0f0846e64219772348de106dd), [`18c67db`](https://github.com/mastra-ai/mastra/commit/18c67dbb9c9ebc26f26f65f7d3ff836e5691ef46), [`4ba3bb1`](https://github.com/mastra-ai/mastra/commit/4ba3bb1e465ad2ddaba3bbf2bc47e0faec32985e), [`190f452`](https://github.com/mastra-ai/mastra/commit/190f45258b0640e2adfc8219fa3258cdc5b8f071), [`5d84914`](https://github.com/mastra-ai/mastra/commit/5d84914e0e520c642a40329b210b413fcd139898), [`8dcc77e`](https://github.com/mastra-ai/mastra/commit/8dcc77e78a5340f5848f74b9e9f1b3da3513c1f5), [`aa67fc5`](https://github.com/mastra-ai/mastra/commit/aa67fc59ee8a5eeff1f23eb05970b8d7a536c8ff), [`fd2f314`](https://github.com/mastra-ai/mastra/commit/fd2f31473d3449b6b97e837ef8641264377f41a7), [`fa8140b`](https://github.com/mastra-ai/mastra/commit/fa8140bcd4251d2e3ac85fdc5547dfc4f372b5be), [`190f452`](https://github.com/mastra-ai/mastra/commit/190f45258b0640e2adfc8219fa3258cdc5b8f071), [`e80fead`](https://github.com/mastra-ai/mastra/commit/e80fead1412cc0d1b2f7d6a1ce5017d9e0098ff7), [`0287b64`](https://github.com/mastra-ai/mastra/commit/0287b644a5c3272755cf3112e71338106664103b), [`a6b7d82`](https://github.com/mastra-ai/mastra/commit/a6b7d820d5028da1284899baf3a7318b5d573f42), [`f5e254f`](https://github.com/mastra-ai/mastra/commit/f5e254f2984c4aae25e26a34ac2e2bbd637b27a6), [`6544c97`](https://github.com/mastra-ai/mastra/commit/6544c974182bccfb31f48efff07671ac528d1533), [`8ce5d0d`](https://github.com/mastra-ai/mastra/commit/8ce5d0dab0e13ee9ce01562fc434523e93a71ef9), [`7e7bf60`](https://github.com/mastra-ai/mastra/commit/7e7bf606886bf374a6f9d4ca9b09dd83d0533372), [`184907d`](https://github.com/mastra-ai/mastra/commit/184907d775d8609c03c26e78ccaf37315f3aa287), [`18c67db`](https://github.com/mastra-ai/mastra/commit/18c67dbb9c9ebc26f26f65f7d3ff836e5691ef46), [`075e91a`](https://github.com/mastra-ai/mastra/commit/075e91a4549baf46ad7a42a6a8ac8dfa78cc09e6), [`5cf84a3`](https://github.com/mastra-ai/mastra/commit/5cf84a3e2b7aa69b3f674a6f312f1bf0ed7ebead), [`5f3d4dd`](https://github.com/mastra-ai/mastra/commit/5f3d4ddf237241f4b238ac062ac61eadabed0770), [`0c4cd13`](https://github.com/mastra-ai/mastra/commit/0c4cd131931c04ac5405373c932a242dbe88edd6), [`190f452`](https://github.com/mastra-ai/mastra/commit/190f45258b0640e2adfc8219fa3258cdc5b8f071), [`b16a753`](https://github.com/mastra-ai/mastra/commit/b16a753d5748440248d7df82e29bb987a9c8386c)]:
  - @mastra/core@1.25.0
  - @mastra/stagehand@0.2.0
  - @mastra/agent-browser@0.2.0
  - @mastra/pg@1.9.1
  - @mastra/libsql@1.8.1
  - @mastra/memory@1.15.1
  - @mastra/mcp@1.5.0

## 0.14.0-alpha.5

### Patch Changes

- Updated dependencies [[`5cf84a3`](https://github.com/mastra-ai/mastra/commit/5cf84a3e2b7aa69b3f674a6f312f1bf0ed7ebead)]:
  - @mastra/mcp@1.5.0-alpha.1

## 0.14.0-alpha.4

### Minor Changes

- Added `/browser set` command for configuring browser profile, executable path, storage state, and CDP URL. Updated the interactive wizard with advanced options for custom browsers and CDP connections. ([#15194](https://github.com/mastra-ai/mastra/pull/15194))

### Patch Changes

- Improved Mastra Code prompt guidance for autonomous decisions and blocked work. ([#15352](https://github.com/mastra-ai/mastra/pull/15352))

- Improved observational memory summaries to use caveman-style custom instructions for terser stored observations. ([#15359](https://github.com/mastra-ai/mastra/pull/15359))

- Updated dependencies [[`8687969`](https://github.com/mastra-ai/mastra/commit/86879696b80f87269bec34fd17fa377bce3a5892), [`cbdf3e1`](https://github.com/mastra-ai/mastra/commit/cbdf3e12b3d0c30a6e5347be658e2009648c130a), [`8fe46d3`](https://github.com/mastra-ai/mastra/commit/8fe46d354027f3f0f0846e64219772348de106dd), [`18c67db`](https://github.com/mastra-ai/mastra/commit/18c67dbb9c9ebc26f26f65f7d3ff836e5691ef46), [`190f452`](https://github.com/mastra-ai/mastra/commit/190f45258b0640e2adfc8219fa3258cdc5b8f071), [`8dcc77e`](https://github.com/mastra-ai/mastra/commit/8dcc77e78a5340f5848f74b9e9f1b3da3513c1f5), [`aa67fc5`](https://github.com/mastra-ai/mastra/commit/aa67fc59ee8a5eeff1f23eb05970b8d7a536c8ff), [`fa8140b`](https://github.com/mastra-ai/mastra/commit/fa8140bcd4251d2e3ac85fdc5547dfc4f372b5be), [`190f452`](https://github.com/mastra-ai/mastra/commit/190f45258b0640e2adfc8219fa3258cdc5b8f071), [`a6b7d82`](https://github.com/mastra-ai/mastra/commit/a6b7d820d5028da1284899baf3a7318b5d573f42), [`8ce5d0d`](https://github.com/mastra-ai/mastra/commit/8ce5d0dab0e13ee9ce01562fc434523e93a71ef9), [`7e7bf60`](https://github.com/mastra-ai/mastra/commit/7e7bf606886bf374a6f9d4ca9b09dd83d0533372), [`184907d`](https://github.com/mastra-ai/mastra/commit/184907d775d8609c03c26e78ccaf37315f3aa287), [`18c67db`](https://github.com/mastra-ai/mastra/commit/18c67dbb9c9ebc26f26f65f7d3ff836e5691ef46), [`5f3d4dd`](https://github.com/mastra-ai/mastra/commit/5f3d4ddf237241f4b238ac062ac61eadabed0770), [`0c4cd13`](https://github.com/mastra-ai/mastra/commit/0c4cd131931c04ac5405373c932a242dbe88edd6), [`190f452`](https://github.com/mastra-ai/mastra/commit/190f45258b0640e2adfc8219fa3258cdc5b8f071), [`b16a753`](https://github.com/mastra-ai/mastra/commit/b16a753d5748440248d7df82e29bb987a9c8386c)]:
  - @mastra/stagehand@0.2.0-alpha.0
  - @mastra/core@1.25.0-alpha.3
  - @mastra/agent-browser@0.2.0-alpha.0
  - @mastra/pg@1.9.1-alpha.1
  - @mastra/libsql@1.8.1-alpha.1
  - @mastra/mcp@1.5.0-alpha.0

## 0.14.0-alpha.3

### Minor Changes

- Added /api-keys command to manage API keys for model providers. You can add, update, or remove keys directly, or access it from the settings menu. ([#15014](https://github.com/mastra-ai/mastra/pull/15014))

### Patch Changes

- Updated dependencies [[`f5e254f`](https://github.com/mastra-ai/mastra/commit/f5e254f2984c4aae25e26a34ac2e2bbd637b27a6), [`6544c97`](https://github.com/mastra-ai/mastra/commit/6544c974182bccfb31f48efff07671ac528d1533)]:
  - @mastra/pg@1.9.1-alpha.0
  - @mastra/libsql@1.8.1-alpha.0

## 0.13.1-alpha.2

### Patch Changes

- Updated dependencies [[`4ba3bb1`](https://github.com/mastra-ai/mastra/commit/4ba3bb1e465ad2ddaba3bbf2bc47e0faec32985e)]:
  - @mastra/core@1.25.0-alpha.2
  - @mastra/mcp@1.4.2
  - @mastra/memory@1.15.1-alpha.1

## 0.13.1-alpha.1

### Patch Changes

- Fixed symlinked skill paths so workspace skills resolve consistently and allowed path checks work through both symlink and real paths. ([#15228](https://github.com/mastra-ai/mastra/pull/15228))

- Updated dependencies [[`8fad147`](https://github.com/mastra-ai/mastra/commit/8fad14759804179c8e080ce4d9dec6ef1a808b31), [`582644c`](https://github.com/mastra-ai/mastra/commit/582644c4a87f83b4f245a84d72b9e8590585012e), [`5d84914`](https://github.com/mastra-ai/mastra/commit/5d84914e0e520c642a40329b210b413fcd139898), [`fd2f314`](https://github.com/mastra-ai/mastra/commit/fd2f31473d3449b6b97e837ef8641264377f41a7), [`e80fead`](https://github.com/mastra-ai/mastra/commit/e80fead1412cc0d1b2f7d6a1ce5017d9e0098ff7), [`0287b64`](https://github.com/mastra-ai/mastra/commit/0287b644a5c3272755cf3112e71338106664103b)]:
  - @mastra/core@1.25.0-alpha.1

## 0.13.1-alpha.0

### Patch Changes

- Updated dependencies [[`87df955`](https://github.com/mastra-ai/mastra/commit/87df955c028660c075873fd5d74af28233ce32eb), [`075e91a`](https://github.com/mastra-ai/mastra/commit/075e91a4549baf46ad7a42a6a8ac8dfa78cc09e6)]:
  - @mastra/core@1.24.2-alpha.0
  - @mastra/memory@1.15.1-alpha.0

## 0.13.0

### Minor Changes

- Added --thread, --title, and --clone-thread CLI options to headless mode for thread control. The most recent thread is now automatically resumed by default, and --continue is deprecated. ([#14962](https://github.com/mastra-ai/mastra/pull/14962))

### Patch Changes

- Fixed task list leaking across threads when switching conversations. Tasks from the previous thread no longer appear in the new thread. ([#15192](https://github.com/mastra-ai/mastra/pull/15192))

- Added collapsible output for shell passthrough (! commands). Output now defaults to 20 lines with Ctrl+E to expand/collapse, matching the existing tool call output behavior. ([#15092](https://github.com/mastra-ai/mastra/pull/15092))

- Updated dependencies [[`ef94400`](https://github.com/mastra-ai/mastra/commit/ef9440049402596b31f2ab976c5e4508f6cb6c91), [`3db852b`](https://github.com/mastra-ai/mastra/commit/3db852bff74e29f60d415a7b0f1583d6ce2bad92)]:
  - @mastra/core@1.24.1

## 0.13.0-alpha.2

### Patch Changes

- Fixed task list leaking across threads when switching conversations. Tasks from the previous thread no longer appear in the new thread. ([#15192](https://github.com/mastra-ai/mastra/pull/15192))

- Updated dependencies [[`3db852b`](https://github.com/mastra-ai/mastra/commit/3db852bff74e29f60d415a7b0f1583d6ce2bad92)]:
  - @mastra/core@1.24.1-alpha.1

## 0.13.0-alpha.1

### Minor Changes

- Added --thread, --title, and --clone-thread CLI options to headless mode for thread control. The most recent thread is now automatically resumed by default, and --continue is deprecated. ([#14962](https://github.com/mastra-ai/mastra/pull/14962))

## 0.12.2-alpha.0

### Patch Changes

- Added collapsible output for shell passthrough (! commands). Output now defaults to 20 lines with Ctrl+E to expand/collapse, matching the existing tool call output behavior. ([#15092](https://github.com/mastra-ai/mastra/pull/15092))

- Updated dependencies [[`ef94400`](https://github.com/mastra-ai/mastra/commit/ef9440049402596b31f2ab976c5e4508f6cb6c91)]:
  - @mastra/core@1.24.1-alpha.0

## 0.12.1

### Patch Changes

- Added support for Agent Skills spec directories (.agents/skills/) for skill discovery, both project-local and global (~/.agents/skills/) ([#15151](https://github.com/mastra-ai/mastra/pull/15151))

- Updated dependencies [[`8db7663`](https://github.com/mastra-ai/mastra/commit/8db7663c9a9c735828094c359d2e327fd4f8fba3), [`60b7d4a`](https://github.com/mastra-ai/mastra/commit/60b7d4a428c6caeca94f4740978359bb40c4ab37), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa), [`153e864`](https://github.com/mastra-ai/mastra/commit/153e86476b425db7cd0dc8490050096e92964a38), [`f308d62`](https://github.com/mastra-ai/mastra/commit/f308d6206a083eeaccbca782be062c57076935d7), [`715710d`](https://github.com/mastra-ai/mastra/commit/715710d12fa47cf88e09d41f13843eddc29327b0), [`378c6c4`](https://github.com/mastra-ai/mastra/commit/378c6c4755726e8d8cf83a14809b350b90d46c62), [`9f91fd5`](https://github.com/mastra-ai/mastra/commit/9f91fd538ab2a44f8cc740bcad8e51205f74fbea), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa), [`6f714ec`](https://github.com/mastra-ai/mastra/commit/6f714ec9a5614222761fd6ea3d53af1da9ab6034), [`98209a0`](https://github.com/mastra-ai/mastra/commit/98209a03c35c5479c25cca26ee0c63eff81e6d74), [`2bdb5fd`](https://github.com/mastra-ai/mastra/commit/2bdb5fd887bfd81bdb71c4a5db22a4fda99f2591)]:
  - @mastra/core@1.24.0
  - @mastra/memory@1.15.0
  - @mastra/mcp@1.4.2

## 0.12.1-alpha.4

### Patch Changes

- Updated dependencies [[`60b7d4a`](https://github.com/mastra-ai/mastra/commit/60b7d4a428c6caeca94f4740978359bb40c4ab37)]:
  - @mastra/memory@1.15.0-alpha.3

## 0.12.1-alpha.3

### Patch Changes

- Updated dependencies [[`6f714ec`](https://github.com/mastra-ai/mastra/commit/6f714ec9a5614222761fd6ea3d53af1da9ab6034), [`2bdb5fd`](https://github.com/mastra-ai/mastra/commit/2bdb5fd887bfd81bdb71c4a5db22a4fda99f2591)]:
  - @mastra/memory@1.15.0-alpha.2
  - @mastra/mcp@1.4.2-alpha.1

## 0.12.1-alpha.2

### Patch Changes

- Added support for Agent Skills spec directories (.agents/skills/) for skill discovery, both project-local and global (~/.agents/skills/) ([#15151](https://github.com/mastra-ai/mastra/pull/15151))

- Updated dependencies [[`8db7663`](https://github.com/mastra-ai/mastra/commit/8db7663c9a9c735828094c359d2e327fd4f8fba3), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa), [`715710d`](https://github.com/mastra-ai/mastra/commit/715710d12fa47cf88e09d41f13843eddc29327b0), [`378c6c4`](https://github.com/mastra-ai/mastra/commit/378c6c4755726e8d8cf83a14809b350b90d46c62), [`9f91fd5`](https://github.com/mastra-ai/mastra/commit/9f91fd538ab2a44f8cc740bcad8e51205f74fbea), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa)]:
  - @mastra/core@1.24.0-alpha.1
  - @mastra/memory@1.15.0-alpha.1

## 0.12.1-alpha.1

### Patch Changes

- Updated dependencies [[`153e864`](https://github.com/mastra-ai/mastra/commit/153e86476b425db7cd0dc8490050096e92964a38), [`98209a0`](https://github.com/mastra-ai/mastra/commit/98209a03c35c5479c25cca26ee0c63eff81e6d74)]:
  - @mastra/core@1.23.1-alpha.0
  - @mastra/mcp@1.4.2-alpha.0

## 0.12.1-alpha.0

### Patch Changes

- Updated dependencies [[`f308d62`](https://github.com/mastra-ai/mastra/commit/f308d6206a083eeaccbca782be062c57076935d7)]:
  - @mastra/memory@1.15.0-alpha.0

## 0.12.0

### Minor Changes

- Added `/browser` command to enable, disable, and configure browser automation providers (Stagehand or AgentBrowser) from the TUI, with settings persisted between sessions. ([#15036](https://github.com/mastra-ai/mastra/pull/15036))

### Patch Changes

- Fixed mastracode TUI memory usage during long sessions by pruning older rendered chat components after each agent turn. ([#15082](https://github.com/mastra-ai/mastra/pull/15082))

  The chat view now keeps recent conversation history available while preventing unbounded growth from rendered messages, tool outputs, slash command boxes, and system reminders.

- Updated dependencies [[`f32b9e1`](https://github.com/mastra-ai/mastra/commit/f32b9e115a3c754d1c8cfa3f4256fba87b09cfb7), [`7d6f521`](https://github.com/mastra-ai/mastra/commit/7d6f52164d0cca099f0b07cb2bba334360f1c8ab), [`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245), [`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245), [`665477b`](https://github.com/mastra-ai/mastra/commit/665477bc104fd52cfef8e7610d7664781a70c220), [`4cc2755`](https://github.com/mastra-ai/mastra/commit/4cc2755a7194cb08720ff2ab4dffb4b4a5103dfd), [`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`ed425d7`](https://github.com/mastra-ai/mastra/commit/ed425d78e7c66cbda8209fee910856f98c6c6b82), [`a4c0c78`](https://github.com/mastra-ai/mastra/commit/a4c0c78264013624e5fe369f9a27aa25f3401012), [`1371703`](https://github.com/mastra-ai/mastra/commit/1371703835080450ef3f9aea58059a95d0da2e5a), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`98f8a8b`](https://github.com/mastra-ai/mastra/commit/98f8a8bdf5761b9982f3ad3acbe7f1cc3efa71f3), [`ba6f7e9`](https://github.com/mastra-ai/mastra/commit/ba6f7e9086d8281393f2acae60fda61de3bff1f9), [`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245), [`7eb2596`](https://github.com/mastra-ai/mastra/commit/7eb25960d607e07468c9a10c5437abd2deaf1e9a), [`aced936`](https://github.com/mastra-ai/mastra/commit/aced93644d7544ef631c530b960ba1278dcef7f4), [`1805ddc`](https://github.com/mastra-ai/mastra/commit/1805ddc9c9b3b14b63749735a13c05a45af43a80), [`fff91cf`](https://github.com/mastra-ai/mastra/commit/fff91cf914de0e731578aacebffdeebef82f0440), [`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`61109b3`](https://github.com/mastra-ai/mastra/commit/61109b34feb0e38d54bee4b8ca83eb7345b1d557), [`33f1ead`](https://github.com/mastra-ai/mastra/commit/33f1eadfa19c86953f593478e5fa371093b33779)]:
  - @mastra/core@1.23.0
  - @mastra/pg@1.9.0
  - @mastra/libsql@1.8.0
  - @mastra/memory@1.14.0

## 0.12.0-alpha.9

### Patch Changes

- Updated dependencies [[`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245), [`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245), [`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245)]:
  - @mastra/core@1.23.0-alpha.9
  - @mastra/pg@1.9.0-alpha.0
  - @mastra/libsql@1.8.0-alpha.0

## 0.12.0-alpha.8

### Patch Changes

- Updated dependencies [[`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`aced936`](https://github.com/mastra-ai/mastra/commit/aced93644d7544ef631c530b960ba1278dcef7f4), [`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`61109b3`](https://github.com/mastra-ai/mastra/commit/61109b34feb0e38d54bee4b8ca83eb7345b1d557), [`33f1ead`](https://github.com/mastra-ai/mastra/commit/33f1eadfa19c86953f593478e5fa371093b33779)]:
  - @mastra/core@1.23.0-alpha.8
  - @mastra/memory@1.14.0-alpha.2

## 0.12.0-alpha.7

### Patch Changes

- Updated dependencies [[`665477b`](https://github.com/mastra-ai/mastra/commit/665477bc104fd52cfef8e7610d7664781a70c220), [`4cc2755`](https://github.com/mastra-ai/mastra/commit/4cc2755a7194cb08720ff2ab4dffb4b4a5103dfd)]:
  - @mastra/core@1.23.0-alpha.7

## 0.12.0-alpha.6

### Minor Changes

- Added `/browser` command to enable, disable, and configure browser automation providers (Stagehand or AgentBrowser) from the TUI, with settings persisted between sessions. ([#15036](https://github.com/mastra-ai/mastra/pull/15036))

### Patch Changes

- Fixed mastracode TUI memory usage during long sessions by pruning older rendered chat components after each agent turn. ([#15082](https://github.com/mastra-ai/mastra/pull/15082))

  The chat view now keeps recent conversation history available while preventing unbounded growth from rendered messages, tool outputs, slash command boxes, and system reminders.

- Updated dependencies [[`7d6f521`](https://github.com/mastra-ai/mastra/commit/7d6f52164d0cca099f0b07cb2bba334360f1c8ab)]:
  - @mastra/core@1.23.0-alpha.6

## 0.11.1-alpha.5

### Patch Changes

- Updated dependencies [[`1371703`](https://github.com/mastra-ai/mastra/commit/1371703835080450ef3f9aea58059a95d0da2e5a), [`98f8a8b`](https://github.com/mastra-ai/mastra/commit/98f8a8bdf5761b9982f3ad3acbe7f1cc3efa71f3)]:
  - @mastra/core@1.23.0-alpha.5

## 0.11.1-alpha.4

### Patch Changes

- Updated dependencies [[`a4c0c78`](https://github.com/mastra-ai/mastra/commit/a4c0c78264013624e5fe369f9a27aa25f3401012), [`fff91cf`](https://github.com/mastra-ai/mastra/commit/fff91cf914de0e731578aacebffdeebef82f0440)]:
  - @mastra/memory@1.14.0-alpha.1
  - @mastra/core@1.23.0-alpha.4

## 0.11.1-alpha.3

### Patch Changes

- Updated dependencies [[`1805ddc`](https://github.com/mastra-ai/mastra/commit/1805ddc9c9b3b14b63749735a13c05a45af43a80)]:
  - @mastra/core@1.23.0-alpha.3

## 0.11.1-alpha.2

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.23.0-alpha.2

## 0.11.1-alpha.1

### Patch Changes

- Updated dependencies [[`f32b9e1`](https://github.com/mastra-ai/mastra/commit/f32b9e115a3c754d1c8cfa3f4256fba87b09cfb7)]:
  - @mastra/core@1.23.0-alpha.1

## 0.11.1-alpha.0

### Patch Changes

- Updated dependencies [[`ed425d7`](https://github.com/mastra-ai/mastra/commit/ed425d78e7c66cbda8209fee910856f98c6c6b82), [`ba6f7e9`](https://github.com/mastra-ai/mastra/commit/ba6f7e9086d8281393f2acae60fda61de3bff1f9), [`7eb2596`](https://github.com/mastra-ai/mastra/commit/7eb25960d607e07468c9a10c5437abd2deaf1e9a)]:
  - @mastra/core@1.23.0-alpha.0
  - @mastra/memory@1.13.2-alpha.0

## 0.11.0

### Minor Changes

- Added Mastra Gateway integration with `/memory-gateway` setup command and automatic provider sync on startup. ([#14952](https://github.com/mastra-ai/mastra/pull/14952))

### Patch Changes

- Mask sensitive input fields (API keys, credentials, connection strings) in settings and login dialogs so they display as asterisks instead of plaintext ([#14936](https://github.com/mastra-ai/mastra/pull/14936))

- Updated dependencies [[`cb15509`](https://github.com/mastra-ai/mastra/commit/cb15509b58f6a83e11b765c945082afc027db972), [`81e4259`](https://github.com/mastra-ai/mastra/commit/81e425939b4ceeb4f586e9b6d89c3b1c1f2d2fe7), [`951b8a1`](https://github.com/mastra-ai/mastra/commit/951b8a1b5ef7e1474c59dc4f2b9fc1a8b1e508b6), [`80c5668`](https://github.com/mastra-ai/mastra/commit/80c5668e365470d3a96d3e953868fd7a643ff67c), [`3d478c1`](https://github.com/mastra-ai/mastra/commit/3d478c1e13f17b80f330ac49d7aa42ef929b93ff), [`2b4ea10`](https://github.com/mastra-ai/mastra/commit/2b4ea10b053e4ea1ab232d536933a4a3c4cba999), [`a0544f0`](https://github.com/mastra-ai/mastra/commit/a0544f0a1e6bd52ac12676228967c1938e43648d), [`6039f17`](https://github.com/mastra-ai/mastra/commit/6039f176f9c457304825ff1df8c83b8e457376c0), [`06b928d`](https://github.com/mastra-ai/mastra/commit/06b928dfc2f5630d023467476cc5919dfa858d0a), [`6a8d984`](https://github.com/mastra-ai/mastra/commit/6a8d9841f2933456ee1598099f488d742b600054), [`c8c86aa`](https://github.com/mastra-ai/mastra/commit/c8c86aa1458017fbd1c0776fdc0c520d129df8a6)]:
  - @mastra/core@1.22.0
  - @mastra/libsql@1.7.4
  - @mastra/pg@1.8.6
  - @mastra/memory@1.13.1

## 0.11.0-alpha.3

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.22.0-alpha.3

## 0.11.0-alpha.2

### Patch Changes

- Updated dependencies [[`cb15509`](https://github.com/mastra-ai/mastra/commit/cb15509b58f6a83e11b765c945082afc027db972), [`80c5668`](https://github.com/mastra-ai/mastra/commit/80c5668e365470d3a96d3e953868fd7a643ff67c), [`3d478c1`](https://github.com/mastra-ai/mastra/commit/3d478c1e13f17b80f330ac49d7aa42ef929b93ff), [`6039f17`](https://github.com/mastra-ai/mastra/commit/6039f176f9c457304825ff1df8c83b8e457376c0), [`06b928d`](https://github.com/mastra-ai/mastra/commit/06b928dfc2f5630d023467476cc5919dfa858d0a), [`6a8d984`](https://github.com/mastra-ai/mastra/commit/6a8d9841f2933456ee1598099f488d742b600054)]:
  - @mastra/core@1.22.0-alpha.2
  - @mastra/libsql@1.7.4-alpha.0
  - @mastra/pg@1.8.6-alpha.0
  - @mastra/memory@1.13.1-alpha.0

## 0.11.0-alpha.1

### Patch Changes

- Mask sensitive input fields (API keys, credentials, connection strings) in settings and login dialogs so they display as asterisks instead of plaintext ([#14936](https://github.com/mastra-ai/mastra/pull/14936))

- Updated dependencies [[`81e4259`](https://github.com/mastra-ai/mastra/commit/81e425939b4ceeb4f586e9b6d89c3b1c1f2d2fe7), [`951b8a1`](https://github.com/mastra-ai/mastra/commit/951b8a1b5ef7e1474c59dc4f2b9fc1a8b1e508b6)]:
  - @mastra/core@1.22.0-alpha.1

## 0.11.0-alpha.0

### Minor Changes

- Added Mastra Gateway integration with `/memory-gateway` setup command and automatic provider sync on startup. ([#14952](https://github.com/mastra-ai/mastra/pull/14952))

### Patch Changes

- Updated dependencies [[`2b4ea10`](https://github.com/mastra-ai/mastra/commit/2b4ea10b053e4ea1ab232d536933a4a3c4cba999), [`a0544f0`](https://github.com/mastra-ai/mastra/commit/a0544f0a1e6bd52ac12676228967c1938e43648d), [`c8c86aa`](https://github.com/mastra-ai/mastra/commit/c8c86aa1458017fbd1c0776fdc0c520d129df8a6)]:
  - @mastra/core@1.22.0-alpha.0

## 0.10.3

### Patch Changes

- Disabled MCP tool result timeout in MastraCode to allow for long running tools ([#14960](https://github.com/mastra-ai/mastra/pull/14960))

- Fixed agent sandbox instructions to use the `request_access` tool instead of telling users to manually run `/sandbox`. The agent now requests directory access interactively, reducing friction when working with files outside the project root. ([#14961](https://github.com/mastra-ai/mastra/pull/14961))

- Updated dependencies [[`9a43b47`](https://github.com/mastra-ai/mastra/commit/9a43b476465e86c9aca381c2831066b5c33c999a), [`ec5c319`](https://github.com/mastra-ai/mastra/commit/ec5c3197a50d034cb8e9cc494eebfddc684b5d81), [`6517789`](https://github.com/mastra-ai/mastra/commit/65177895b74b5471fe2245c7292f0176d9b3385d), [`13f4327`](https://github.com/mastra-ai/mastra/commit/13f4327f052faebe199cefbe906d33bf90238767), [`9ad6aa6`](https://github.com/mastra-ai/mastra/commit/9ad6aa6dfe858afc6955d1df5f3f78c40bb96b9c), [`2862127`](https://github.com/mastra-ai/mastra/commit/2862127d0a7cbd28523120ad64fea067a95838e6), [`3d16814`](https://github.com/mastra-ai/mastra/commit/3d16814c395931373543728994ff45ac98093074), [`7f498d0`](https://github.com/mastra-ai/mastra/commit/7f498d099eacef64fd43ee412e3bd6f87965a8a6), [`5467a87`](https://github.com/mastra-ai/mastra/commit/5467a87090d6359980344c443737c059afe5cc11), [`8cf8a67`](https://github.com/mastra-ai/mastra/commit/8cf8a67b061b737cb06d501fb8c1967a98bbf3cb), [`d7827e3`](https://github.com/mastra-ai/mastra/commit/d7827e393937c6cb0c7a744dde4d31538cb542b7)]:
  - @mastra/core@1.21.0
  - @mastra/memory@1.13.0

## 0.10.3-alpha.2

### Patch Changes

- Disabled MCP tool result timeout in MastraCode to allow for long running tools ([#14960](https://github.com/mastra-ai/mastra/pull/14960))

- Fixed agent sandbox instructions to use the `request_access` tool instead of telling users to manually run `/sandbox`. The agent now requests directory access interactively, reducing friction when working with files outside the project root. ([#14961](https://github.com/mastra-ai/mastra/pull/14961))

- Updated dependencies [[`ec5c319`](https://github.com/mastra-ai/mastra/commit/ec5c3197a50d034cb8e9cc494eebfddc684b5d81), [`6517789`](https://github.com/mastra-ai/mastra/commit/65177895b74b5471fe2245c7292f0176d9b3385d), [`9ad6aa6`](https://github.com/mastra-ai/mastra/commit/9ad6aa6dfe858afc6955d1df5f3f78c40bb96b9c), [`2862127`](https://github.com/mastra-ai/mastra/commit/2862127d0a7cbd28523120ad64fea067a95838e6), [`3d16814`](https://github.com/mastra-ai/mastra/commit/3d16814c395931373543728994ff45ac98093074), [`7f498d0`](https://github.com/mastra-ai/mastra/commit/7f498d099eacef64fd43ee412e3bd6f87965a8a6), [`8cf8a67`](https://github.com/mastra-ai/mastra/commit/8cf8a67b061b737cb06d501fb8c1967a98bbf3cb), [`d7827e3`](https://github.com/mastra-ai/mastra/commit/d7827e393937c6cb0c7a744dde4d31538cb542b7)]:
  - @mastra/core@1.21.0-alpha.2

## 0.10.3-alpha.1

### Patch Changes

- Updated dependencies [[`13f4327`](https://github.com/mastra-ai/mastra/commit/13f4327f052faebe199cefbe906d33bf90238767), [`5467a87`](https://github.com/mastra-ai/mastra/commit/5467a87090d6359980344c443737c059afe5cc11)]:
  - @mastra/core@1.21.0-alpha.1
  - @mastra/memory@1.13.0-alpha.0

## 0.10.3-alpha.0

### Patch Changes

- Updated dependencies [[`9a43b47`](https://github.com/mastra-ai/mastra/commit/9a43b476465e86c9aca381c2831066b5c33c999a)]:
  - @mastra/core@1.21.0-alpha.0

## 0.10.2

### Patch Changes

- Updated dependencies [[`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`cee146b`](https://github.com/mastra-ai/mastra/commit/cee146b5d858212e1df2b2730fc36d3ceda0e08d), [`aa0aeff`](https://github.com/mastra-ai/mastra/commit/aa0aeffa11efbef5e219fbd97bf43d263cfe3afe), [`2bcec65`](https://github.com/mastra-ai/mastra/commit/2bcec652d62b07eab15e9eb9822f70184526eede), [`ad9bded`](https://github.com/mastra-ai/mastra/commit/ad9bdedf86a824801f49928a8d40f6e31ff5450f), [`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`208c0bb`](https://github.com/mastra-ai/mastra/commit/208c0bbacbf5a1da6318f2a0e0c544390e542ddc), [`f566ee7`](https://github.com/mastra-ai/mastra/commit/f566ee7d53a3da33a01103e2a5ac2070ddefe6b0)]:
  - @mastra/core@1.20.0
  - @mastra/memory@1.12.1
  - @mastra/mcp@1.4.1

## 0.10.2-alpha.0

### Patch Changes

- Updated dependencies [[`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`cee146b`](https://github.com/mastra-ai/mastra/commit/cee146b5d858212e1df2b2730fc36d3ceda0e08d), [`aa0aeff`](https://github.com/mastra-ai/mastra/commit/aa0aeffa11efbef5e219fbd97bf43d263cfe3afe), [`2bcec65`](https://github.com/mastra-ai/mastra/commit/2bcec652d62b07eab15e9eb9822f70184526eede), [`ad9bded`](https://github.com/mastra-ai/mastra/commit/ad9bdedf86a824801f49928a8d40f6e31ff5450f), [`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`208c0bb`](https://github.com/mastra-ai/mastra/commit/208c0bbacbf5a1da6318f2a0e0c544390e542ddc), [`f566ee7`](https://github.com/mastra-ai/mastra/commit/f566ee7d53a3da33a01103e2a5ac2070ddefe6b0)]:
  - @mastra/core@1.20.0-alpha.0
  - @mastra/memory@1.12.1-alpha.0
  - @mastra/mcp@1.4.1-alpha.0

## 0.10.1

### Patch Changes

- Fixed /subagents to show configured subagents from the harness config. ([#14804](https://github.com/mastra-ai/mastra/pull/14804))

- Tools that return objects with circular references no longer crash the agent with "Converting circular structure to JSON". Circular parts are replaced with `"[Circular]"` and the conversation continues normally. ([#14535](https://github.com/mastra-ai/mastra/pull/14535))

- Updated dependencies [[`180aaaf`](https://github.com/mastra-ai/mastra/commit/180aaaf4d0903d33a49bc72de2d40ca69a5bc599), [`25bbff6`](https://github.com/mastra-ai/mastra/commit/25bbff67dadc01d5a18095574421f6266f610b17), [`9140989`](https://github.com/mastra-ai/mastra/commit/91409890e83f4f1d9c1b39223f1af91a6a53b549), [`542977f`](https://github.com/mastra-ai/mastra/commit/542977fe5043678df071ad3982b6bcbc78d95f02), [`d7c98cf`](https://github.com/mastra-ai/mastra/commit/d7c98cfc9d75baba9ecbf1a8835b5183d0a0aec8), [`acf5fbc`](https://github.com/mastra-ai/mastra/commit/acf5fbcb890dc7ca7167bec386ce5874dfadb997), [`24ca2ae`](https://github.com/mastra-ai/mastra/commit/24ca2ae57538ec189fabb9daee6175ad27035853), [`0762516`](https://github.com/mastra-ai/mastra/commit/07625167e029a8268ea7aaf0402416e6d8832874), [`9c57f2f`](https://github.com/mastra-ai/mastra/commit/9c57f2f7241e9f94769aa99fc86c531e8207d0f9), [`5bfc691`](https://github.com/mastra-ai/mastra/commit/5bfc69104c07ba7a9b55c2f8536422c0878b9c57), [`e91c011`](https://github.com/mastra-ai/mastra/commit/e91c0119878d956fdaab9b60ac721f93f3221335), [`d2d0bea`](https://github.com/mastra-ai/mastra/commit/d2d0beaafba2e25b9ad368015ce91312c372f6a5), [`2de3d36`](https://github.com/mastra-ai/mastra/commit/2de3d36932b7f73ad26bc403f7da26cfe89e903e), [`d3736cb`](https://github.com/mastra-ai/mastra/commit/d3736cb9ce074d2b8e8b00218a01f790fe81a1b4), [`c627366`](https://github.com/mastra-ai/mastra/commit/c6273666f9ef4c8c617c68b7d07fe878a322f85c), [`66a7412`](https://github.com/mastra-ai/mastra/commit/66a7412ec0550f3dfa01cd05b057d8c6e5b062bc)]:
  - @mastra/core@1.19.0
  - @mastra/memory@1.12.0
  - @mastra/pg@1.8.5
  - @mastra/mcp@1.4.0

## 0.10.1-alpha.2

### Patch Changes

- Updated dependencies [[`542977f`](https://github.com/mastra-ai/mastra/commit/542977fe5043678df071ad3982b6bcbc78d95f02), [`9c57f2f`](https://github.com/mastra-ai/mastra/commit/9c57f2f7241e9f94769aa99fc86c531e8207d0f9), [`5bfc691`](https://github.com/mastra-ai/mastra/commit/5bfc69104c07ba7a9b55c2f8536422c0878b9c57), [`d2d0bea`](https://github.com/mastra-ai/mastra/commit/d2d0beaafba2e25b9ad368015ce91312c372f6a5)]:
  - @mastra/memory@1.12.0-alpha.1
  - @mastra/core@1.19.0-alpha.2

## 0.10.1-alpha.1

### Patch Changes

- Fixed /subagents to show configured subagents from the harness config. ([#14804](https://github.com/mastra-ai/mastra/pull/14804))

- Tools that return objects with circular references no longer crash the agent with "Converting circular structure to JSON". Circular parts are replaced with `"[Circular]"` and the conversation continues normally. ([#14535](https://github.com/mastra-ai/mastra/pull/14535))

- Updated dependencies [[`9140989`](https://github.com/mastra-ai/mastra/commit/91409890e83f4f1d9c1b39223f1af91a6a53b549), [`d7c98cf`](https://github.com/mastra-ai/mastra/commit/d7c98cfc9d75baba9ecbf1a8835b5183d0a0aec8), [`acf5fbc`](https://github.com/mastra-ai/mastra/commit/acf5fbcb890dc7ca7167bec386ce5874dfadb997), [`24ca2ae`](https://github.com/mastra-ai/mastra/commit/24ca2ae57538ec189fabb9daee6175ad27035853), [`0762516`](https://github.com/mastra-ai/mastra/commit/07625167e029a8268ea7aaf0402416e6d8832874), [`e91c011`](https://github.com/mastra-ai/mastra/commit/e91c0119878d956fdaab9b60ac721f93f3221335), [`2de3d36`](https://github.com/mastra-ai/mastra/commit/2de3d36932b7f73ad26bc403f7da26cfe89e903e), [`d3736cb`](https://github.com/mastra-ai/mastra/commit/d3736cb9ce074d2b8e8b00218a01f790fe81a1b4), [`c627366`](https://github.com/mastra-ai/mastra/commit/c6273666f9ef4c8c617c68b7d07fe878a322f85c), [`66a7412`](https://github.com/mastra-ai/mastra/commit/66a7412ec0550f3dfa01cd05b057d8c6e5b062bc)]:
  - @mastra/core@1.18.1-alpha.1
  - @mastra/pg@1.8.5-alpha.0
  - @mastra/mcp@1.4.0-alpha.0

## 0.10.1-alpha.0

### Patch Changes

- Updated dependencies [[`180aaaf`](https://github.com/mastra-ai/mastra/commit/180aaaf4d0903d33a49bc72de2d40ca69a5bc599), [`25bbff6`](https://github.com/mastra-ai/mastra/commit/25bbff67dadc01d5a18095574421f6266f610b17)]:
  - @mastra/core@1.18.1-alpha.0
  - @mastra/memory@1.11.1-alpha.0

## 0.10.0

### Minor Changes

- Added a "Custom response..." option to questions with predefined choices. When selected, it switches to a free-text input so you can type an answer not covered by the given options. ([#14845](https://github.com/mastra-ai/mastra/pull/14845))

- Added a /thread command to show the active thread, resource, and pending-new-thread state. ([#14567](https://github.com/mastra-ai/mastra/pull/14567))

### Patch Changes

- Persist observational memory threshold settings across restarts and restore per-thread overrides. ([#14788](https://github.com/mastra-ai/mastra/pull/14788))

- Improved Mastra Code prompt guidance so responses stay concise and terminal-friendly. ([#14688](https://github.com/mastra-ai/mastra/pull/14688))

- Fixed provider name quoting in gateway sync to properly quote digit-leading provider IDs (e.g. `302ai`), preventing repeated "invalid provider-types in global cache" warnings from GatewayRegistry. ([#14867](https://github.com/mastra-ai/mastra/pull/14867))

- Limit dynamically injected AGENTS.md reminders to 1000 estimated tokens by default and tell mastracode observational memory to ignore those ephemeral reminder messages. ([#14790](https://github.com/mastra-ai/mastra/pull/14790))

- Improved the Loaded AGENTS.md reminder in the TUI so it uses the new bordered notice style and collapses long reminder content by default. ([#14637](https://github.com/mastra-ai/mastra/pull/14637))

- Fixed the thread selector so it shows all threads consistently and opens faster. ([#14690](https://github.com/mastra-ai/mastra/pull/14690))

- Custom slash commands now load correctly from all configured directories ([#14727](https://github.com/mastra-ai/mastra/pull/14727))

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067), [`e333b77`](https://github.com/mastra-ai/mastra/commit/e333b77e2d76ba57ccec1818e08cebc1993469ff), [`dc9fc19`](https://github.com/mastra-ai/mastra/commit/dc9fc19da4437f6b508cc355f346a8856746a76b), [`60a224d`](https://github.com/mastra-ai/mastra/commit/60a224dd497240e83698cfa5bfd02e3d1d854844), [`0dbaab9`](https://github.com/mastra-ai/mastra/commit/0dbaab988103f27495c37fd820f03a632eab2c59), [`fbf22a7`](https://github.com/mastra-ai/mastra/commit/fbf22a7ad86bcb50dcf30459f0d075e51ddeb468), [`1662721`](https://github.com/mastra-ai/mastra/commit/1662721aac59ad048b5df80323bdfb836fccbbfe), [`f16d92c`](https://github.com/mastra-ai/mastra/commit/f16d92c677a119a135cebcf7e2b9f51ada7a9df4), [`949b7bf`](https://github.com/mastra-ai/mastra/commit/949b7bfd4e40f2b2cba7fef5eb3f108a02cfe938), [`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`12c647c`](https://github.com/mastra-ai/mastra/commit/12c647cf3a26826eb72d40b42e3c8356ceae16ed), [`d084b66`](https://github.com/mastra-ai/mastra/commit/d084b6692396057e83c086b954c1857d20b58a14), [`79c699a`](https://github.com/mastra-ai/mastra/commit/79c699acf3cd8a77e11c55530431f48eb48456e9), [`62757b6`](https://github.com/mastra-ai/mastra/commit/62757b6db6e8bb86569d23ad0b514178f57053f8), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`819f03c`](https://github.com/mastra-ai/mastra/commit/819f03c25823373b32476413bd76be28a5d8705a), [`04160ee`](https://github.com/mastra-ai/mastra/commit/04160eedf3130003cf842ad08428c8ff69af4cc1), [`7302e5c`](https://github.com/mastra-ai/mastra/commit/7302e5ce0f52d769d3d63fb0faa8a7d4089cda6d), [`2c27503`](https://github.com/mastra-ai/mastra/commit/2c275032510d131d2cde47f99953abf0fe02c081), [`424a1df`](https://github.com/mastra-ai/mastra/commit/424a1df7bee59abb5c83717a54807fdd674a6224), [`3d70b0b`](https://github.com/mastra-ai/mastra/commit/3d70b0b3524d817173ad870768f259c06d61bd23), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`43595bf`](https://github.com/mastra-ai/mastra/commit/43595bf7b8df1a6edce7a23b445b5124d2a0b473), [`260fe12`](https://github.com/mastra-ai/mastra/commit/260fe1295fe7354e39d6def2775e0797a7a277f0), [`fbf22a7`](https://github.com/mastra-ai/mastra/commit/fbf22a7ad86bcb50dcf30459f0d075e51ddeb468), [`12c88a6`](https://github.com/mastra-ai/mastra/commit/12c88a6e32bf982c2fe0c6af62e65a3414519a75), [`43595bf`](https://github.com/mastra-ai/mastra/commit/43595bf7b8df1a6edce7a23b445b5124d2a0b473), [`78670e9`](https://github.com/mastra-ai/mastra/commit/78670e97e76d7422cf7025faf371b2aeafed860d), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778), [`3b45a13`](https://github.com/mastra-ai/mastra/commit/3b45a138d09d040779c0aba1edbbfc1b57442d23), [`dd668a0`](https://github.com/mastra-ai/mastra/commit/dd668a0e4d6b3fd75cbe780028b578f0ac0ec635), [`d400e7c`](https://github.com/mastra-ai/mastra/commit/d400e7c8b8d7afa6ba2c71769eace4048e3cef8e), [`d657856`](https://github.com/mastra-ai/mastra/commit/d6578561c104fecfeb3caa17dc07d1acbeeffff7), [`f58d1a7`](https://github.com/mastra-ai/mastra/commit/f58d1a7a457588a996c3ecb53201a68f3d28c432), [`a49a929`](https://github.com/mastra-ai/mastra/commit/a49a92904968b4fc67e01effee8c7c8d0464ba85), [`8127d96`](https://github.com/mastra-ai/mastra/commit/8127d96280492e335d49b244501088dfdd59a8f1)]:
  - @mastra/core@1.18.0
  - @mastra/memory@1.11.0
  - @mastra/pg@1.8.4
  - @mastra/libsql@1.7.3
  - @mastra/mcp@1.3.2

## 0.10.0-alpha.8

### Minor Changes

- Added a "Custom response..." option to questions with predefined choices. When selected, it switches to a free-text input so you can type an answer not covered by the given options. ([#14845](https://github.com/mastra-ai/mastra/pull/14845))

### Patch Changes

- Updated dependencies [[`12c647c`](https://github.com/mastra-ai/mastra/commit/12c647cf3a26826eb72d40b42e3c8356ceae16ed), [`819f03c`](https://github.com/mastra-ai/mastra/commit/819f03c25823373b32476413bd76be28a5d8705a)]:
  - @mastra/core@1.18.0-alpha.5

## 0.10.0-alpha.7

### Patch Changes

- Updated dependencies [[`fbf22a7`](https://github.com/mastra-ai/mastra/commit/fbf22a7ad86bcb50dcf30459f0d075e51ddeb468), [`04160ee`](https://github.com/mastra-ai/mastra/commit/04160eedf3130003cf842ad08428c8ff69af4cc1), [`2c27503`](https://github.com/mastra-ai/mastra/commit/2c275032510d131d2cde47f99953abf0fe02c081), [`424a1df`](https://github.com/mastra-ai/mastra/commit/424a1df7bee59abb5c83717a54807fdd674a6224), [`43595bf`](https://github.com/mastra-ai/mastra/commit/43595bf7b8df1a6edce7a23b445b5124d2a0b473), [`fbf22a7`](https://github.com/mastra-ai/mastra/commit/fbf22a7ad86bcb50dcf30459f0d075e51ddeb468), [`12c88a6`](https://github.com/mastra-ai/mastra/commit/12c88a6e32bf982c2fe0c6af62e65a3414519a75), [`43595bf`](https://github.com/mastra-ai/mastra/commit/43595bf7b8df1a6edce7a23b445b5124d2a0b473), [`78670e9`](https://github.com/mastra-ai/mastra/commit/78670e97e76d7422cf7025faf371b2aeafed860d), [`d400e7c`](https://github.com/mastra-ai/mastra/commit/d400e7c8b8d7afa6ba2c71769eace4048e3cef8e), [`f58d1a7`](https://github.com/mastra-ai/mastra/commit/f58d1a7a457588a996c3ecb53201a68f3d28c432), [`a49a929`](https://github.com/mastra-ai/mastra/commit/a49a92904968b4fc67e01effee8c7c8d0464ba85)]:
  - @mastra/core@1.18.0-alpha.4
  - @mastra/mcp@1.3.2-alpha.0
  - @mastra/libsql@1.7.3-alpha.3
  - @mastra/pg@1.8.4-alpha.3

## 0.10.0-alpha.6

### Minor Changes

- Added a /thread command to show the active thread, resource, and pending-new-thread state. ([#14567](https://github.com/mastra-ai/mastra/pull/14567))

### Patch Changes

- Persist observational memory threshold settings across restarts and restore per-thread overrides. ([#14788](https://github.com/mastra-ai/mastra/pull/14788))

- Limit dynamically injected AGENTS.md reminders to 1000 estimated tokens by default and tell mastracode observational memory to ignore those ephemeral reminder messages. ([#14790](https://github.com/mastra-ai/mastra/pull/14790))

- Updated dependencies [[`e333b77`](https://github.com/mastra-ai/mastra/commit/e333b77e2d76ba57ccec1818e08cebc1993469ff), [`60a224d`](https://github.com/mastra-ai/mastra/commit/60a224dd497240e83698cfa5bfd02e3d1d854844), [`949b7bf`](https://github.com/mastra-ai/mastra/commit/949b7bfd4e40f2b2cba7fef5eb3f108a02cfe938), [`d084b66`](https://github.com/mastra-ai/mastra/commit/d084b6692396057e83c086b954c1857d20b58a14), [`79c699a`](https://github.com/mastra-ai/mastra/commit/79c699acf3cd8a77e11c55530431f48eb48456e9), [`62757b6`](https://github.com/mastra-ai/mastra/commit/62757b6db6e8bb86569d23ad0b514178f57053f8), [`3d70b0b`](https://github.com/mastra-ai/mastra/commit/3d70b0b3524d817173ad870768f259c06d61bd23), [`3b45a13`](https://github.com/mastra-ai/mastra/commit/3b45a138d09d040779c0aba1edbbfc1b57442d23), [`dd668a0`](https://github.com/mastra-ai/mastra/commit/dd668a0e4d6b3fd75cbe780028b578f0ac0ec635), [`8127d96`](https://github.com/mastra-ai/mastra/commit/8127d96280492e335d49b244501088dfdd59a8f1)]:
  - @mastra/core@1.18.0-alpha.3
  - @mastra/memory@1.11.0-alpha.4

## 0.9.3-alpha.5

### Patch Changes

- Custom slash commands now load correctly from all configured directories ([#14727](https://github.com/mastra-ai/mastra/pull/14727))

- Updated dependencies [[`f16d92c`](https://github.com/mastra-ai/mastra/commit/f16d92c677a119a135cebcf7e2b9f51ada7a9df4)]:
  - @mastra/core@1.18.0-alpha.2

## 0.9.3-alpha.4

### Patch Changes

- Updated dependencies [[`dc9fc19`](https://github.com/mastra-ai/mastra/commit/dc9fc19da4437f6b508cc355f346a8856746a76b), [`0dbaab9`](https://github.com/mastra-ai/mastra/commit/0dbaab988103f27495c37fd820f03a632eab2c59), [`1662721`](https://github.com/mastra-ai/mastra/commit/1662721aac59ad048b5df80323bdfb836fccbbfe), [`260fe12`](https://github.com/mastra-ai/mastra/commit/260fe1295fe7354e39d6def2775e0797a7a277f0)]:
  - @mastra/core@1.18.0-alpha.1
  - @mastra/memory@1.10.1-alpha.3
  - @mastra/libsql@1.7.3-alpha.2
  - @mastra/pg@1.8.4-alpha.2

## 0.9.3-alpha.3

### Patch Changes

- Improved Mastra Code prompt guidance so responses stay concise and terminal-friendly. ([#14688](https://github.com/mastra-ai/mastra/pull/14688))

- Improved the Loaded AGENTS.md reminder in the TUI so it uses the new bordered notice style and collapses long reminder content by default. ([#14637](https://github.com/mastra-ai/mastra/pull/14637))

- Fixed the thread selector so it shows all threads consistently and opens faster. ([#14690](https://github.com/mastra-ai/mastra/pull/14690))

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067), [`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`7302e5c`](https://github.com/mastra-ai/mastra/commit/7302e5ce0f52d769d3d63fb0faa8a7d4089cda6d), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778), [`d657856`](https://github.com/mastra-ai/mastra/commit/d6578561c104fecfeb3caa17dc07d1acbeeffff7)]:
  - @mastra/core@1.18.0-alpha.0
  - @mastra/memory@1.10.1-alpha.2
  - @mastra/pg@1.8.4-alpha.1
  - @mastra/libsql@1.7.3-alpha.1

## 0.9.3-alpha.2

### Patch Changes

- Improved Mastra Code prompt guidance so responses stay concise and terminal-friendly. ([#14688](https://github.com/mastra-ai/mastra/pull/14688))

- Improved the Loaded AGENTS.md reminder in the TUI so it uses the new bordered notice style and collapses long reminder content by default. ([#14637](https://github.com/mastra-ai/mastra/pull/14637))

- Fixed the thread selector so it shows all threads consistently and opens faster. ([#14690](https://github.com/mastra-ai/mastra/pull/14690))

- Updated dependencies [[`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`86e3263`](https://github.com/mastra-ai/mastra/commit/86e326363edd12be5a5b25ccce4a39f66f7c9f50), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778)]:
  - @mastra/core@1.17.0-alpha.2

## 0.9.3-alpha.1

### Patch Changes

- Updated dependencies [[`7302e5c`](https://github.com/mastra-ai/mastra/commit/7302e5ce0f52d769d3d63fb0faa8a7d4089cda6d)]:
  - @mastra/memory@1.10.1-alpha.1
  - @mastra/core@1.16.1-alpha.1
  - @mastra/pg@1.8.4-alpha.0
  - @mastra/libsql@1.7.3-alpha.0

## 0.9.3-alpha.0

### Patch Changes

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067), [`d657856`](https://github.com/mastra-ai/mastra/commit/d6578561c104fecfeb3caa17dc07d1acbeeffff7)]:
  - @mastra/core@1.16.1-alpha.0
  - @mastra/memory@1.10.1-alpha.0

## 0.9.2

### Patch Changes

- Added macOS sleep prevention while Mastra Code is actively running. ([#14586](https://github.com/mastra-ai/mastra/pull/14586))

  Mastra Code now starts the built-in caffeinate utility only while an agent run is in progress, then releases it after completion, aborts, errors, or app shutdown.

  To opt out, set MASTRACODE_DISABLE_CAFFEINATE=1 before launching Mastra Code.

- Removed the Anthropic OAuth warning flow from Mastra Code. ([#14605](https://github.com/mastra-ai/mastra/pull/14605))

  `/login`, startup, and the setup wizard no longer interrupt Anthropic OAuth with the Claude Max warning prompt, and the related onboarding setting has been removed. Anthropic has confirmed that users do not get banned for using Claude max oauth. https://x.com/trq212/status/2035076299774206228?s=20

- Mastra Code now defaults the OpenAI mode pack to use `openai/gpt-5.4` for build and plan, and `openai/gpt-5.4-mini` for fast mode. The OpenAI OM pack selected during setup now defaults to `openai/gpt-5.4-mini`. ([#14604](https://github.com/mastra-ai/mastra/pull/14604))

- Improved Mastra Code autonomy prompts by expanding the default guidance around assumptions, persistence, and when to ask questions. Also applied GPT-5.4-specific prompt instructions consistently during prompt assembly. ([#14587](https://github.com/mastra-ai/mastra/pull/14587))

- Updated dependencies [[`68ed4e9`](https://github.com/mastra-ai/mastra/commit/68ed4e9f118e8646b60a6112dabe854d0ef53902), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`be37de4`](https://github.com/mastra-ai/mastra/commit/be37de4391bd1d5486ce38efacbf00ca51637262), [`7dbd611`](https://github.com/mastra-ai/mastra/commit/7dbd611a85cb1e0c0a1581c57564268cb183d86e), [`f14604c`](https://github.com/mastra-ai/mastra/commit/f14604c7ef01ba794e1a8d5c7bae5415852aacec), [`4a75e10`](https://github.com/mastra-ai/mastra/commit/4a75e106bd31c283a1b3fe74c923610dcc46415b), [`f3ce603`](https://github.com/mastra-ai/mastra/commit/f3ce603fd76180f4a5be90b6dc786d389b6b3e98), [`423aa6f`](https://github.com/mastra-ai/mastra/commit/423aa6fd12406de6a1cc6b68e463d30af1d790fb), [`f21c626`](https://github.com/mastra-ai/mastra/commit/f21c6263789903ab9720b4d11373093298e97f15), [`41aee84`](https://github.com/mastra-ai/mastra/commit/41aee84561ceebe28bad1ecba8702d92838f67f0), [`2871451`](https://github.com/mastra-ai/mastra/commit/2871451703829aefa06c4a5d6eca7fd3731222ef), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`e06b520`](https://github.com/mastra-ai/mastra/commit/e06b520bdd5fdef844760c5e692c7852cbc5c240), [`d3930ea`](https://github.com/mastra-ai/mastra/commit/d3930eac51c30b0ecf7eaa54bb9430758b399777), [`dd9c4e0`](https://github.com/mastra-ai/mastra/commit/dd9c4e0a47962f1413e9b72114fcad912e19a0a6), [`23bd359`](https://github.com/mastra-ai/mastra/commit/23bd359c50898c3b28b9ee25ce47c12614da5a36)]:
  - @mastra/core@1.16.0
  - @mastra/libsql@1.7.2
  - @mastra/pg@1.8.3
  - @mastra/memory@1.10.0
  - @mastra/mcp@1.3.1

## 0.9.2-alpha.6

### Patch Changes

- Updated dependencies [[`f21c626`](https://github.com/mastra-ai/mastra/commit/f21c6263789903ab9720b4d11373093298e97f15)]:
  - @mastra/core@1.16.0-alpha.5

## 0.9.2-alpha.5

### Patch Changes

- Updated dependencies [[`f14604c`](https://github.com/mastra-ai/mastra/commit/f14604c7ef01ba794e1a8d5c7bae5415852aacec), [`e06b520`](https://github.com/mastra-ai/mastra/commit/e06b520bdd5fdef844760c5e692c7852cbc5c240), [`dd9c4e0`](https://github.com/mastra-ai/mastra/commit/dd9c4e0a47962f1413e9b72114fcad912e19a0a6)]:
  - @mastra/core@1.16.0-alpha.4
  - @mastra/memory@1.10.0-alpha.2

## 0.9.2-alpha.4

### Patch Changes

- Updated dependencies [[`423aa6f`](https://github.com/mastra-ai/mastra/commit/423aa6fd12406de6a1cc6b68e463d30af1d790fb), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124)]:
  - @mastra/core@1.16.0-alpha.3
  - @mastra/mcp@1.3.1
  - @mastra/memory@1.9.1-alpha.1

## 0.9.2-alpha.3

### Patch Changes

- Removed the Anthropic OAuth warning flow from Mastra Code. ([#14605](https://github.com/mastra-ai/mastra/pull/14605))

  `/login`, startup, and the setup wizard no longer interrupt Anthropic OAuth with the Claude Max warning prompt, and the related onboarding setting has been removed. Anthropic has confirmed that users do not get banned for using Claude max oauth. https://x.com/trq212/status/2035076299774206228?s=20

- Mastra Code now defaults the OpenAI mode pack to use `openai/gpt-5.4` for build and plan, and `openai/gpt-5.4-mini` for fast mode. The OpenAI OM pack selected during setup now defaults to `openai/gpt-5.4-mini`. ([#14604](https://github.com/mastra-ai/mastra/pull/14604))

- Updated dependencies [[`be37de4`](https://github.com/mastra-ai/mastra/commit/be37de4391bd1d5486ce38efacbf00ca51637262), [`f3ce603`](https://github.com/mastra-ai/mastra/commit/f3ce603fd76180f4a5be90b6dc786d389b6b3e98), [`2871451`](https://github.com/mastra-ai/mastra/commit/2871451703829aefa06c4a5d6eca7fd3731222ef), [`d3930ea`](https://github.com/mastra-ai/mastra/commit/d3930eac51c30b0ecf7eaa54bb9430758b399777), [`23bd359`](https://github.com/mastra-ai/mastra/commit/23bd359c50898c3b28b9ee25ce47c12614da5a36)]:
  - @mastra/core@1.16.0-alpha.2
  - @mastra/memory@1.9.1-alpha.0
  - @mastra/mcp@1.3.1

## 0.9.2-alpha.2

### Patch Changes

- Added macOS sleep prevention while Mastra Code is actively running. ([#14586](https://github.com/mastra-ai/mastra/pull/14586))

  Mastra Code now starts the built-in caffeinate utility only while an agent run is in progress, then releases it after completion, aborts, errors, or app shutdown.

  To opt out, set MASTRACODE_DISABLE_CAFFEINATE=1 before launching Mastra Code.

- Updated dependencies [[`7dbd611`](https://github.com/mastra-ai/mastra/commit/7dbd611a85cb1e0c0a1581c57564268cb183d86e), [`41aee84`](https://github.com/mastra-ai/mastra/commit/41aee84561ceebe28bad1ecba8702d92838f67f0)]:
  - @mastra/core@1.16.0-alpha.1
  - @mastra/libsql@1.7.2-alpha.1
  - @mastra/pg@1.8.3-alpha.1

## 0.9.2-alpha.1

### Patch Changes

- Improved Mastra Code autonomy prompts by expanding the default guidance around assumptions, persistence, and when to ask questions. Also applied GPT-5.4-specific prompt instructions consistently during prompt assembly. ([#14587](https://github.com/mastra-ai/mastra/pull/14587))

## 0.9.2-alpha.0

### Patch Changes

- Updated dependencies [[`68ed4e9`](https://github.com/mastra-ai/mastra/commit/68ed4e9f118e8646b60a6112dabe854d0ef53902), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`4a75e10`](https://github.com/mastra-ai/mastra/commit/4a75e106bd31c283a1b3fe74c923610dcc46415b), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c)]:
  - @mastra/core@1.16.0-alpha.0
  - @mastra/libsql@1.7.2-alpha.0
  - @mastra/pg@1.8.3-alpha.0

## 0.9.1

### Patch Changes

- Fixed mastracode to forward harness thread and resource headers to model providers. ([#14433](https://github.com/mastra-ai/mastra/pull/14433))

- Removed italic styling from tool arguments (shell commands, web search queries, and generic tool args) for improved readability in the terminal. ([#14472](https://github.com/mastra-ai/mastra/pull/14472))

- Added thread title support to Mastra Code. ([#14436](https://github.com/mastra-ai/mastra/pull/14436))
  - Show live thread title update markers in the chat history.
  - Display non-generic thread titles in the status bar and thread picker.
  - Auto-truncate long titles to fit available terminal width.

- Fixed inline text questions so long answers wrap inside the question box instead of crashing the terminal render. ([#14479](https://github.com/mastra-ai/mastra/pull/14479))

- Improved `/threads` so it opens quickly with batched lazy preview loading, reuses cached previews across the active TUI session, and refreshes cached previews whenever a thread's `updatedAt` changes. ([#14428](https://github.com/mastra-ai/mastra/pull/14428))

- Improved the Mastra Code TUI with clearer user history styling and a smoother active prompt animation. ([#14423](https://github.com/mastra-ai/mastra/pull/14423))

- Fixed mastracode dependency ranges to use explicit semver constraints instead of latest. ([#14541](https://github.com/mastra-ai/mastra/pull/14541))

- Updated dependencies [[`cb611a1`](https://github.com/mastra-ai/mastra/commit/cb611a1e89a4f4cf74c97b57e0c27bb56f2eceb5), [`da93115`](https://github.com/mastra-ai/mastra/commit/da931155c1a9bc63d455d3d86b4ec984db5991fe), [`44df54a`](https://github.com/mastra-ai/mastra/commit/44df54a28e6315d9699cf437e4f3e8c7c7d10217), [`62d1d3c`](https://github.com/mastra-ai/mastra/commit/62d1d3cc08fe8182e7080237fd975de862ec8c91), [`9e1a3ed`](https://github.com/mastra-ai/mastra/commit/9e1a3ed07cfafb5e8e19a796ce0bee817002d7c0), [`56c9ad9`](https://github.com/mastra-ai/mastra/commit/56c9ad9c871d258af9da4d6e50065b01d339bf34), [`0773d08`](https://github.com/mastra-ai/mastra/commit/0773d089859210217702d3175ad4b2f3d63d267e), [`8681ecb`](https://github.com/mastra-ai/mastra/commit/8681ecb86184d5907267000e4576cc442a9a83fc), [`888c512`](https://github.com/mastra-ai/mastra/commit/888c5121e370289713d560a99bce58814e2fbb69), [`28d0249`](https://github.com/mastra-ai/mastra/commit/28d0249295782277040ad1e0d243e695b7ab1ce4), [`681ee1c`](https://github.com/mastra-ai/mastra/commit/681ee1c811359efd1b8bebc4bce35b9bb7b14bec), [`bb0f09d`](https://github.com/mastra-ai/mastra/commit/bb0f09dbac58401b36069f483acf5673202db5b5), [`6a8f1e6`](https://github.com/mastra-ai/mastra/commit/6a8f1e66272d2928351db334da091ee27e304c23), [`a579f7a`](https://github.com/mastra-ai/mastra/commit/a579f7a31e582674862b5679bc79af7ccf7429b8), [`5f7e9d0`](https://github.com/mastra-ai/mastra/commit/5f7e9d0db664020e1f3d97d7d18c6b0b9d4843d0), [`aa664b2`](https://github.com/mastra-ai/mastra/commit/aa664b218c15d397598c71194a8603b5b5a691bb), [`d7f14c3`](https://github.com/mastra-ai/mastra/commit/d7f14c3285cd253ecdd5f58139b7b6cbdf3678b5), [`0efe12a`](https://github.com/mastra-ai/mastra/commit/0efe12a5f008a939a1aac71699486ba40138054e)]:
  - @mastra/core@1.15.0
  - @mastra/memory@1.9.0
  - @mastra/mcp@1.3.1
  - @mastra/pg@1.8.2

## 0.9.1-alpha.5

### Patch Changes

- Fixed mastracode dependency ranges to use explicit semver constraints instead of latest. ([#14541](https://github.com/mastra-ai/mastra/pull/14541))

## 0.9.1-alpha.4

### Patch Changes

- Updated dependencies [[`da93115`](https://github.com/mastra-ai/mastra/commit/da931155c1a9bc63d455d3d86b4ec984db5991fe), [`44df54a`](https://github.com/mastra-ai/mastra/commit/44df54a28e6315d9699cf437e4f3e8c7c7d10217), [`0efe12a`](https://github.com/mastra-ai/mastra/commit/0efe12a5f008a939a1aac71699486ba40138054e)]:
  - @mastra/memory@1.9.0-alpha.2
  - @mastra/core@1.15.0-alpha.4
  - @mastra/mcp@1.3.1-alpha.1

## 0.9.1-alpha.3

### Patch Changes

- Updated dependencies [[`888c512`](https://github.com/mastra-ai/mastra/commit/888c5121e370289713d560a99bce58814e2fbb69), [`d7f14c3`](https://github.com/mastra-ai/mastra/commit/d7f14c3285cd253ecdd5f58139b7b6cbdf3678b5)]:
  - @mastra/pg@1.8.2-alpha.0
  - @mastra/core@1.15.0-alpha.3

## 0.9.1-alpha.2

### Patch Changes

- Updated dependencies [[`9e1a3ed`](https://github.com/mastra-ai/mastra/commit/9e1a3ed07cfafb5e8e19a796ce0bee817002d7c0), [`a579f7a`](https://github.com/mastra-ai/mastra/commit/a579f7a31e582674862b5679bc79af7ccf7429b8)]:
  - @mastra/core@1.15.0-alpha.2

## 0.9.1-alpha.1

### Patch Changes

- Fixed mastracode to forward harness thread and resource headers to model providers. ([#14433](https://github.com/mastra-ai/mastra/pull/14433))

- Removed italic styling from tool arguments (shell commands, web search queries, and generic tool args) for improved readability in the terminal. ([#14472](https://github.com/mastra-ai/mastra/pull/14472))

- Added thread title support to Mastra Code. ([#14436](https://github.com/mastra-ai/mastra/pull/14436))
  - Show live thread title update markers in the chat history.
  - Display non-generic thread titles in the status bar and thread picker.
  - Auto-truncate long titles to fit available terminal width.

- Fixed inline text questions so long answers wrap inside the question box instead of crashing the terminal render. ([#14479](https://github.com/mastra-ai/mastra/pull/14479))

- Improved `/threads` so it opens quickly with batched lazy preview loading, reuses cached previews across the active TUI session, and refreshes cached previews whenever a thread's `updatedAt` changes. ([#14428](https://github.com/mastra-ai/mastra/pull/14428))

- Improved the Mastra Code TUI with clearer user history styling and a smoother active prompt animation. ([#14423](https://github.com/mastra-ai/mastra/pull/14423))

- Updated dependencies [[`681ee1c`](https://github.com/mastra-ai/mastra/commit/681ee1c811359efd1b8bebc4bce35b9bb7b14bec), [`aa664b2`](https://github.com/mastra-ai/mastra/commit/aa664b218c15d397598c71194a8603b5b5a691bb)]:
  - @mastra/core@1.15.0-alpha.1
  - @mastra/memory@1.9.0-alpha.1
  - @mastra/mcp@1.3.1-alpha.0

## 0.9.1-alpha.0

### Patch Changes

- Updated dependencies [[`cb611a1`](https://github.com/mastra-ai/mastra/commit/cb611a1e89a4f4cf74c97b57e0c27bb56f2eceb5), [`62d1d3c`](https://github.com/mastra-ai/mastra/commit/62d1d3cc08fe8182e7080237fd975de862ec8c91), [`56c9ad9`](https://github.com/mastra-ai/mastra/commit/56c9ad9c871d258af9da4d6e50065b01d339bf34), [`0773d08`](https://github.com/mastra-ai/mastra/commit/0773d089859210217702d3175ad4b2f3d63d267e), [`8681ecb`](https://github.com/mastra-ai/mastra/commit/8681ecb86184d5907267000e4576cc442a9a83fc), [`28d0249`](https://github.com/mastra-ai/mastra/commit/28d0249295782277040ad1e0d243e695b7ab1ce4), [`bb0f09d`](https://github.com/mastra-ai/mastra/commit/bb0f09dbac58401b36069f483acf5673202db5b5), [`6a8f1e6`](https://github.com/mastra-ai/mastra/commit/6a8f1e66272d2928351db334da091ee27e304c23), [`5f7e9d0`](https://github.com/mastra-ai/mastra/commit/5f7e9d0db664020e1f3d97d7d18c6b0b9d4843d0)]:
  - @mastra/core@1.15.0-alpha.0
  - @mastra/mcp@1.3.1-alpha.0
  - @mastra/memory@1.8.4-alpha.0

## 0.9.0

### Minor Changes

- Improved MCP server management with interactive `/mcp` selector UI. ([#14377](https://github.com/mastra-ai/mastra/pull/14377))
  - **Fixed stderr flooding** — MCP child process debug output no longer corrupts the terminal. Server stderr is piped and buffered instead of inherited.
  - **Fixed console.info race condition** — MCP status messages now display properly in the chat area instead of racing with TUI rendering.
  - **Better error detection** — Failed MCP servers now correctly show as failed instead of showing as connected with 0 tools.
  - **Interactive `/mcp` command** — Replaces text-only output with a navigable overlay (↑↓ to select, Enter for actions, Esc to close). Sub-menus offer View tools, View error, View logs, and Reconnect per server.
  - **Per-server reconnect** — Reconnect individual servers from the `/mcp` selector without restarting all connections.
  - **Live status polling** — The `/mcp` selector auto-refreshes while servers are still connecting.
  - **Connecting state** — Servers show as 'connecting...' during initial startup, visible via `/mcp`.

  **Example**

  ```text
  /mcp
  ```

- Added adaptive light and dark terminal themes with WCAG-compliant contrast. Editor input, messages, tool output, and interactive components now automatically adjust colors and borders for readability across terminal backgrounds. ([#14337](https://github.com/mastra-ai/mastra/pull/14337))

- Added interactive API key prompt when selecting a model without a configured key. When you choose a model from the model selector that lacks an API key, Mastra Code now displays a dialog to enter the key. The key is stored persistently in auth.json and loaded into the environment on subsequent startups. Environment variables always take priority over stored keys. Press Escape to dismiss the prompt and keep the previous behavior. ([#13573](https://github.com/mastra-ai/mastra/pull/13573))

### Patch Changes

- Improved Mastra Code terminal queueing and slash-command behavior while the agent is busy. ([#14250](https://github.com/mastra-ai/mastra/pull/14250))
  - Press `Enter` to send a message normally, or queue a follow-up while the current run is still streaming.
  - Queued follow-up messages and slash commands now drain in the same FIFO order they were entered.
  - Custom slash commands use `//command` so they stay distinct from built-in `/command` entries, including when names overlap.
  - Slash-command autocomplete now defaults to the first visible matching entry instead of jumping to a later custom command match.
  - `/help` and related shortcut text now reflect the updated behavior.

- Fix rendering corruption in some terminal emulators by replacing the per-character gradient animation on the editor input border with a solid mode-color border. ([#14359](https://github.com/mastra-ai/mastra/pull/14359))

- Updated dependencies [[`51970b3`](https://github.com/mastra-ai/mastra/commit/51970b3828494d59a8dd4df143b194d37d31e3f5), [`bbcbbce`](https://github.com/mastra-ai/mastra/commit/bbcbbce4f0e268053cbb11ca58350f5ceba15498), [`4444280`](https://github.com/mastra-ai/mastra/commit/444428094253e916ec077e66284e685fde67021e), [`085e371`](https://github.com/mastra-ai/mastra/commit/085e3718a7d0fe9a210fe7dd1c867b9bdfe8d16b), [`b77aa19`](https://github.com/mastra-ai/mastra/commit/b77aa1981361c021f2c881bee8f0c703687f00da), [`dbb879a`](https://github.com/mastra-ai/mastra/commit/dbb879af0b809c668e9b3a9d8bac97d806caa267), [`dbb879a`](https://github.com/mastra-ai/mastra/commit/dbb879af0b809c668e9b3a9d8bac97d806caa267), [`8b4ce84`](https://github.com/mastra-ai/mastra/commit/8b4ce84aed0808b9805cc4fd7147c1f8a2ef7a36), [`8d4cfe6`](https://github.com/mastra-ai/mastra/commit/8d4cfe6b9a7157d3876206227ec9f04cde6dbc4a), [`247c353`](https://github.com/mastra-ai/mastra/commit/247c3531fa01d1af1014843729f0fba7d3acc953), [`dd6ca1c`](https://github.com/mastra-ai/mastra/commit/dd6ca1cdea3b8b6182f4cf61df41070ba0cc0deb), [`ce26fe2`](https://github.com/mastra-ai/mastra/commit/ce26fe2166dd90254f8bee5776e55977143e97de), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a), [`b92d0c9`](https://github.com/mastra-ai/mastra/commit/b92d0c92ecc833bec9a99af98b3243839c1661be), [`4cb4edf`](https://github.com/mastra-ai/mastra/commit/4cb4edf3c909d197ec356c1790d13270514ffef6), [`8de3555`](https://github.com/mastra-ai/mastra/commit/8de355572c6fd838f863a3e7e6fe24d0947b774f), [`b26307f`](https://github.com/mastra-ai/mastra/commit/b26307f050df39629511b0e831b8fc26973ce8b1), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a), [`133ef20`](https://github.com/mastra-ai/mastra/commit/133ef20c39c696eb0dbbee26e77c8acfec14b8c6), [`4444280`](https://github.com/mastra-ai/mastra/commit/444428094253e916ec077e66284e685fde67021e)]:
  - @mastra/core@1.14.0
  - @mastra/mcp@1.3.0
  - @mastra/pg@1.8.1
  - @mastra/libsql@1.7.1
  - @mastra/memory@1.8.3

## 0.9.0-alpha.3

### Patch Changes

- Updated dependencies [[`8b4ce84`](https://github.com/mastra-ai/mastra/commit/8b4ce84aed0808b9805cc4fd7147c1f8a2ef7a36), [`8d4cfe6`](https://github.com/mastra-ai/mastra/commit/8d4cfe6b9a7157d3876206227ec9f04cde6dbc4a), [`247c353`](https://github.com/mastra-ai/mastra/commit/247c3531fa01d1af1014843729f0fba7d3acc953), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a)]:
  - @mastra/core@1.14.0-alpha.3
  - @mastra/memory@1.8.3-alpha.2

## 0.9.0-alpha.2

### Minor Changes

- Improved MCP server management with interactive `/mcp` selector UI. ([#14377](https://github.com/mastra-ai/mastra/pull/14377))
  - **Fixed stderr flooding** — MCP child process debug output no longer corrupts the terminal. Server stderr is piped and buffered instead of inherited.
  - **Fixed console.info race condition** — MCP status messages now display properly in the chat area instead of racing with TUI rendering.
  - **Better error detection** — Failed MCP servers now correctly show as failed instead of showing as connected with 0 tools.
  - **Interactive `/mcp` command** — Replaces text-only output with a navigable overlay (↑↓ to select, Enter for actions, Esc to close). Sub-menus offer View tools, View error, View logs, and Reconnect per server.
  - **Per-server reconnect** — Reconnect individual servers from the `/mcp` selector without restarting all connections.
  - **Live status polling** — The `/mcp` selector auto-refreshes while servers are still connecting.
  - **Connecting state** — Servers show as 'connecting...' during initial startup, visible via `/mcp`.

  **Example**

  ```text
  /mcp
  ```

### Patch Changes

- Updated dependencies [[`4444280`](https://github.com/mastra-ai/mastra/commit/444428094253e916ec077e66284e685fde67021e), [`dbb879a`](https://github.com/mastra-ai/mastra/commit/dbb879af0b809c668e9b3a9d8bac97d806caa267), [`dbb879a`](https://github.com/mastra-ai/mastra/commit/dbb879af0b809c668e9b3a9d8bac97d806caa267), [`b92d0c9`](https://github.com/mastra-ai/mastra/commit/b92d0c92ecc833bec9a99af98b3243839c1661be), [`8de3555`](https://github.com/mastra-ai/mastra/commit/8de355572c6fd838f863a3e7e6fe24d0947b774f), [`133ef20`](https://github.com/mastra-ai/mastra/commit/133ef20c39c696eb0dbbee26e77c8acfec14b8c6), [`4444280`](https://github.com/mastra-ai/mastra/commit/444428094253e916ec077e66284e685fde67021e)]:
  - @mastra/core@1.14.0-alpha.2
  - @mastra/pg@1.8.1-alpha.0
  - @mastra/libsql@1.7.1-alpha.0
  - @mastra/memory@1.8.3-alpha.1
  - @mastra/mcp@1.3.0-alpha.1

## 0.9.0-alpha.1

### Minor Changes

- Added adaptive light and dark terminal themes with WCAG-compliant contrast. Editor input, messages, tool output, and interactive components now automatically adjust colors and borders for readability across terminal backgrounds. ([#14337](https://github.com/mastra-ai/mastra/pull/14337))

### Patch Changes

- Fix rendering corruption in some terminal emulators by replacing the per-character gradient animation on the editor input border with a solid mode-color border. ([#14359](https://github.com/mastra-ai/mastra/pull/14359))

- Updated dependencies [[`b77aa19`](https://github.com/mastra-ai/mastra/commit/b77aa1981361c021f2c881bee8f0c703687f00da), [`dd6ca1c`](https://github.com/mastra-ai/mastra/commit/dd6ca1cdea3b8b6182f4cf61df41070ba0cc0deb), [`4cb4edf`](https://github.com/mastra-ai/mastra/commit/4cb4edf3c909d197ec356c1790d13270514ffef6)]:
  - @mastra/core@1.13.3-alpha.1

## 0.9.0-alpha.0

### Minor Changes

- Added interactive API key prompt when selecting a model without a configured key. When you choose a model from the model selector that lacks an API key, Mastra Code now displays a dialog to enter the key. The key is stored persistently in auth.json and loaded into the environment on subsequent startups. Environment variables always take priority over stored keys. Press Escape to dismiss the prompt and keep the previous behavior. ([#13573](https://github.com/mastra-ai/mastra/pull/13573))

### Patch Changes

- Improved Mastra Code terminal queueing and slash-command behavior while the agent is busy. ([#14250](https://github.com/mastra-ai/mastra/pull/14250))
  - Press `Enter` to send a message normally, or queue a follow-up while the current run is still streaming.
  - Queued follow-up messages and slash commands now drain in the same FIFO order they were entered.
  - Custom slash commands use `//command` so they stay distinct from built-in `/command` entries, including when names overlap.
  - Slash-command autocomplete now defaults to the first visible matching entry instead of jumping to a later custom command match.
  - `/help` and related shortcut text now reflect the updated behavior.

- Updated dependencies [[`51970b3`](https://github.com/mastra-ai/mastra/commit/51970b3828494d59a8dd4df143b194d37d31e3f5), [`bbcbbce`](https://github.com/mastra-ai/mastra/commit/bbcbbce4f0e268053cbb11ca58350f5ceba15498), [`085e371`](https://github.com/mastra-ai/mastra/commit/085e3718a7d0fe9a210fe7dd1c867b9bdfe8d16b), [`ce26fe2`](https://github.com/mastra-ai/mastra/commit/ce26fe2166dd90254f8bee5776e55977143e97de), [`b26307f`](https://github.com/mastra-ai/mastra/commit/b26307f050df39629511b0e831b8fc26973ce8b1)]:
  - @mastra/core@1.13.3-alpha.0
  - @mastra/mcp@1.2.2-alpha.0
  - @mastra/memory@1.8.3-alpha.0

## 0.8.3

### Patch Changes

- Updated dependencies [[`0ce6035`](https://github.com/mastra-ai/mastra/commit/0ce603591189f547397704e53f23c77bc5630071)]:
  - @mastra/core@1.13.2
  - @mastra/mcp@1.2.1
  - @mastra/memory@1.8.2

## 0.8.3-alpha.0

### Patch Changes

- Updated dependencies [[`0ce6035`](https://github.com/mastra-ai/mastra/commit/0ce603591189f547397704e53f23c77bc5630071)]:
  - @mastra/core@1.13.2-alpha.0
  - @mastra/mcp@1.2.1
  - @mastra/memory@1.8.2-alpha.0

## 0.8.2

### Patch Changes

- Updated dependencies [[`205e76c`](https://github.com/mastra-ai/mastra/commit/205e76c3ba652205dafb037f50a4a8eea73f6736)]:
  - @mastra/core@1.13.1
  - @mastra/mcp@1.2.1
  - @mastra/memory@1.8.1

## 0.8.1

### Patch Changes

- Updated dependencies [[`ea86967`](https://github.com/mastra-ai/mastra/commit/ea86967449426e0a3673253bd1c2c052a99d970d), [`db21c21`](https://github.com/mastra-ai/mastra/commit/db21c21a6ae5f33539262cc535342fa8757eb359), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`6751354`](https://github.com/mastra-ai/mastra/commit/67513544d1a64be891d9de7624d40aadc895d56e), [`c958cd3`](https://github.com/mastra-ai/mastra/commit/c958cd36627c1eea122ec241b2b15492977a263a), [`86f2426`](https://github.com/mastra-ai/mastra/commit/86f242631d252a172d2f9f9a2ea0feb8647a76b0), [`950eb07`](https://github.com/mastra-ai/mastra/commit/950eb07b7e7354629630e218d49550fdd299c452)]:
  - @mastra/core@1.13.0
  - @mastra/mcp@1.2.1
  - @mastra/memory@1.8.0

## 0.8.1-alpha.0

### Patch Changes

- Updated dependencies [[`ea86967`](https://github.com/mastra-ai/mastra/commit/ea86967449426e0a3673253bd1c2c052a99d970d), [`db21c21`](https://github.com/mastra-ai/mastra/commit/db21c21a6ae5f33539262cc535342fa8757eb359), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`6751354`](https://github.com/mastra-ai/mastra/commit/67513544d1a64be891d9de7624d40aadc895d56e), [`c958cd3`](https://github.com/mastra-ai/mastra/commit/c958cd36627c1eea122ec241b2b15492977a263a), [`86f2426`](https://github.com/mastra-ai/mastra/commit/86f242631d252a172d2f9f9a2ea0feb8647a76b0), [`950eb07`](https://github.com/mastra-ai/mastra/commit/950eb07b7e7354629630e218d49550fdd299c452)]:
  - @mastra/core@1.13.0-alpha.0
  - @mastra/mcp@1.2.1-alpha.0
  - @mastra/memory@1.8.0-alpha.0

## 0.8.0

### Minor Changes

- Added `mcpServers` option to `createMastraCode()` for programmatic MCP server configuration. Servers passed via this option are merged with file-based configs at highest priority, allowing you to define MCP servers directly in code: ([#13750](https://github.com/mastra-ai/mastra/pull/13750))

  ```typescript
  const { harness } = await createMastraCode({
    mcpServers: {
      filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] },
      remote: { url: 'https://mcp.example.com/sse', headers: { Authorization: 'Bearer tok' } },
    },
  });
  ```

### Patch Changes

- Fixed tool validation errors being hidden behind a generic 'see details above' message. All errors now display their actual error message consistently. ([#14168](https://github.com/mastra-ai/mastra/pull/14168))

- Fixed `mastracode` schema generation when running the CLI with Zod v4-compatible schemas. The CLI now produces valid object JSON Schema instead of failing on some tool input schemas. ([#14157](https://github.com/mastra-ai/mastra/pull/14157))

- Fixed /om model search in Kitty terminals so typed characters filter models again. ([#13996](https://github.com/mastra-ai/mastra/pull/13996))

- Updated dependencies [[`cddf895`](https://github.com/mastra-ai/mastra/commit/cddf895532b8ee7f9fa814136ec672f53d37a9ba), [`9cede11`](https://github.com/mastra-ai/mastra/commit/9cede110abac9d93072e0521bb3c8bcafb9fdadf), [`a59f126`](https://github.com/mastra-ai/mastra/commit/a59f1269104f54726699c5cdb98c72c93606d2df), [`ed8fd75`](https://github.com/mastra-ai/mastra/commit/ed8fd75cbff03bb5e19971ddb30ab7040fc60447), [`c510833`](https://github.com/mastra-ai/mastra/commit/c5108333e8cbc19dafee5f8bfefbcb5ee935335c), [`c4c7dad`](https://github.com/mastra-ai/mastra/commit/c4c7dadfe2e4584f079f6c24bfabdb8c4981827f), [`b9a77b9`](https://github.com/mastra-ai/mastra/commit/b9a77b951fa6422077080b492cce74460d2f8fdd), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`7296fcc`](https://github.com/mastra-ai/mastra/commit/7296fcc599c876a68699a71c7054a16d5aaf2337), [`00c27f9`](https://github.com/mastra-ai/mastra/commit/00c27f9080731433230a61be69c44e39a7a7b4c7), [`5e7c287`](https://github.com/mastra-ai/mastra/commit/5e7c28701f2bce795dd5c811e4c3060bf2ea2242), [`977b49e`](https://github.com/mastra-ai/mastra/commit/977b49e23d8b050a2c6a6a91c0aa38b28d6388ee), [`7e17d3f`](https://github.com/mastra-ai/mastra/commit/7e17d3f656fdda2aad47c4beb8c491636d70820c), [`ee19c9b`](https://github.com/mastra-ai/mastra/commit/ee19c9ba3ec3ed91feb214ad539bdc766c53bb01)]:
  - @mastra/core@1.12.0
  - @mastra/mcp@1.2.0
  - @mastra/memory@1.7.0

## 0.8.0-alpha.1

### Patch Changes

- Fixed tool validation errors being hidden behind a generic 'see details above' message. All errors now display their actual error message consistently. ([#14168](https://github.com/mastra-ai/mastra/pull/14168))

- Updated dependencies [[`9cede11`](https://github.com/mastra-ai/mastra/commit/9cede110abac9d93072e0521bb3c8bcafb9fdadf), [`a59f126`](https://github.com/mastra-ai/mastra/commit/a59f1269104f54726699c5cdb98c72c93606d2df), [`c510833`](https://github.com/mastra-ai/mastra/commit/c5108333e8cbc19dafee5f8bfefbcb5ee935335c), [`7296fcc`](https://github.com/mastra-ai/mastra/commit/7296fcc599c876a68699a71c7054a16d5aaf2337), [`00c27f9`](https://github.com/mastra-ai/mastra/commit/00c27f9080731433230a61be69c44e39a7a7b4c7), [`977b49e`](https://github.com/mastra-ai/mastra/commit/977b49e23d8b050a2c6a6a91c0aa38b28d6388ee), [`ee19c9b`](https://github.com/mastra-ai/mastra/commit/ee19c9ba3ec3ed91feb214ad539bdc766c53bb01)]:
  - @mastra/core@1.12.0-alpha.1
  - @mastra/memory@1.7.0-alpha.1
  - @mastra/mcp@1.2.0-alpha.0

## 0.8.0-alpha.0

### Minor Changes

- Added `mcpServers` option to `createMastraCode()` for programmatic MCP server configuration. Servers passed via this option are merged with file-based configs at highest priority, allowing you to define MCP servers directly in code: ([#13750](https://github.com/mastra-ai/mastra/pull/13750))

  ```typescript
  const { harness } = await createMastraCode({
    mcpServers: {
      filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] },
      remote: { url: 'https://mcp.example.com/sse', headers: { Authorization: 'Bearer tok' } },
    },
  });
  ```

### Patch Changes

- Fixed `mastracode` schema generation when running the CLI with Zod v4-compatible schemas. The CLI now produces valid object JSON Schema instead of failing on some tool input schemas. ([#14157](https://github.com/mastra-ai/mastra/pull/14157))

- Fixed /om model search in Kitty terminals so typed characters filter models again. ([#13996](https://github.com/mastra-ai/mastra/pull/13996))

- Updated dependencies [[`cddf895`](https://github.com/mastra-ai/mastra/commit/cddf895532b8ee7f9fa814136ec672f53d37a9ba), [`aede3cc`](https://github.com/mastra-ai/mastra/commit/aede3cc2a83b54bbd9e9a54c8aedcd1708b2ef87), [`c4c7dad`](https://github.com/mastra-ai/mastra/commit/c4c7dadfe2e4584f079f6c24bfabdb8c4981827f), [`b9a77b9`](https://github.com/mastra-ai/mastra/commit/b9a77b951fa6422077080b492cce74460d2f8fdd), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`5e7c287`](https://github.com/mastra-ai/mastra/commit/5e7c28701f2bce795dd5c811e4c3060bf2ea2242), [`7e17d3f`](https://github.com/mastra-ai/mastra/commit/7e17d3f656fdda2aad47c4beb8c491636d70820c)]:
  - @mastra/core@1.12.0-alpha.0
  - @mastra/mcp@1.2.0-alpha.0
  - @mastra/memory@1.6.3-alpha.0

## 0.7.0

### Minor Changes

- Added headless non-interactive mode via `--prompt` / `-p` flag. Mastra Code can now run from scripts, CI/CD pipelines, and task orchestration systems without human interaction. All blocking interactions (tool approvals, questions, plan approvals, sandbox access) are auto-resolved. Supports `--timeout`, `--continue`, and `--format json` flags. Exit codes: 0 (success), 1 (error/aborted), 2 (timeout). ([#13648](https://github.com/mastra-ai/mastra/pull/13648))

### Patch Changes

- Improve MastraCode image pasting for clipboard images, local image paths, and remote image URLs. ([#13953](https://github.com/mastra-ai/mastra/pull/13953))

- Improved web_search tool rendering in the TUI. Search results now display a clean list of titles and URLs with the search query in the header, instead of dumping raw JSON. ([#13870](https://github.com/mastra-ai/mastra/pull/13870))

- Improved the shell passthrough command (`! <command>`, e.g. `! ls -la`) to show output as it happens. Previously, running a command like `! ping example.com` would show nothing until the command finished. Now, stdout and stderr stream live into a bordered output box with a spinner that resolves to a success or failure indicator on completion. ([#13999](https://github.com/mastra-ai/mastra/pull/13999))

- Subagents now use the same file and command tools as the parent agent, ensuring consistent behavior across sandbox environments and workspaces. ([#13940](https://github.com/mastra-ai/mastra/pull/13940))

- Updated dependencies [[`4f71b43`](https://github.com/mastra-ai/mastra/commit/4f71b436a4a6b8839842d8da47b57b84509af56c), [`a070277`](https://github.com/mastra-ai/mastra/commit/a07027766ce195ba74d0783116d894cbab25d44c), [`b628b91`](https://github.com/mastra-ai/mastra/commit/b628b9128b372c0f54214d902b07279f03443900), [`332c014`](https://github.com/mastra-ai/mastra/commit/332c014e076b81edf7fe45b58205882726415e90), [`6b63153`](https://github.com/mastra-ai/mastra/commit/6b63153878ea841c0f4ce632ba66bb33e57e9c1b), [`c2d7a7c`](https://github.com/mastra-ai/mastra/commit/c2d7a7c48d89245188c81a9a436ad8b1d9f3872d), [`4246e34`](https://github.com/mastra-ai/mastra/commit/4246e34cec9c26636d0965942268e6d07c346671), [`b8837ee`](https://github.com/mastra-ai/mastra/commit/b8837ee77e2e84197609762bfabd8b3da326d30c), [`866cc2c`](https://github.com/mastra-ai/mastra/commit/866cc2cb1f0e3b314afab5194f69477fada745d1), [`5d950f7`](https://github.com/mastra-ai/mastra/commit/5d950f7bf426a215a1808f0abef7de5c8336ba1c), [`d3ad589`](https://github.com/mastra-ai/mastra/commit/d3ad589a39e66bb783513c4bbf912246bdf18c22), [`28c85b1`](https://github.com/mastra-ai/mastra/commit/28c85b184fc32b40f7f160483c982da6d388ecbd), [`e9a08fb`](https://github.com/mastra-ai/mastra/commit/e9a08fbef1ada7e50e961e2f54f55e8c10b4a45c), [`57c7391`](https://github.com/mastra-ai/mastra/commit/57c739108b9a6c9160352f0468dfe0428c03a234), [`1d0a8a8`](https://github.com/mastra-ai/mastra/commit/1d0a8a8acf33203d5744fc429b090ad8598aa8ed), [`18d91c3`](https://github.com/mastra-ai/mastra/commit/18d91c3b6e905cfd3ba50e7c7dc81164b6aa69ad), [`631ffd8`](https://github.com/mastra-ai/mastra/commit/631ffd82fed108648b448b28e6a90e38c5f53bf5), [`6bcbf8a`](https://github.com/mastra-ai/mastra/commit/6bcbf8a6774d5a53b21d61db8a45ce2593ca1616), [`aae2295`](https://github.com/mastra-ai/mastra/commit/aae2295838a2d329ad6640829e87934790ffe5b8), [`aa61f29`](https://github.com/mastra-ai/mastra/commit/aa61f29ff8095ce46a4ae16e46c4d8c79b2b685b), [`7ff3714`](https://github.com/mastra-ai/mastra/commit/7ff37148515439bb3be009a60e02c3e363299760), [`18c3a90`](https://github.com/mastra-ai/mastra/commit/18c3a90c9e48cf69500e308affeb8eba5860b2af), [`41d79a1`](https://github.com/mastra-ai/mastra/commit/41d79a14bd8cb6de1e2565fd0a04786bae2f211b), [`f35487b`](https://github.com/mastra-ai/mastra/commit/f35487bb2d46c636e22aa71d90025613ae38235a), [`6dc2192`](https://github.com/mastra-ai/mastra/commit/6dc21921aef0f0efab15cd0805fa3d18f277a76f), [`eeb3a3f`](https://github.com/mastra-ai/mastra/commit/eeb3a3f43aca10cf49479eed2a84b7d9ecea02ba), [`e673376`](https://github.com/mastra-ai/mastra/commit/e6733763ad1321aa7e5ae15096b9c2104f93b1f3), [`05f8d90`](https://github.com/mastra-ai/mastra/commit/05f8d9009290ce6aa03428b3add635268615db85), [`b2204c9`](https://github.com/mastra-ai/mastra/commit/b2204c98a42848bbfb6f0440f005dc2b6354f1cd), [`a1bf1e3`](https://github.com/mastra-ai/mastra/commit/a1bf1e385ed4c0ef6f11b56c5887442970d127f2), [`b6f647a`](https://github.com/mastra-ai/mastra/commit/b6f647ae2388e091f366581595feb957e37d5b40), [`0c57b8b`](https://github.com/mastra-ai/mastra/commit/0c57b8b0a69a97b5a4ae3f79be6c610f29f3cf7b), [`b081f27`](https://github.com/mastra-ai/mastra/commit/b081f272cf411716e1d6bd72ceac4bcee2657b19), [`4b8da97`](https://github.com/mastra-ai/mastra/commit/4b8da97a5ce306e97869df6c39535d9069e563db), [`682b7f7`](https://github.com/mastra-ai/mastra/commit/682b7f773b7940687ef22569e720fd4bc4fdb8fe), [`0c09eac`](https://github.com/mastra-ai/mastra/commit/0c09eacb1926f64cfdc9ae5c6d63385cf8c9f72c), [`6b9b93d`](https://github.com/mastra-ai/mastra/commit/6b9b93d6f459d1ba6e36f163abf62a085ddb3d64), [`d3ad589`](https://github.com/mastra-ai/mastra/commit/d3ad589a39e66bb783513c4bbf912246bdf18c22), [`b6f647a`](https://github.com/mastra-ai/mastra/commit/b6f647ae2388e091f366581595feb957e37d5b40), [`31b6067`](https://github.com/mastra-ai/mastra/commit/31b6067d0cc3ab10e1b29c36147f3b5266bc714a), [`797ac42`](https://github.com/mastra-ai/mastra/commit/797ac4276de231ad2d694d9aeca75980f6cd0419), [`0423bf4`](https://github.com/mastra-ai/mastra/commit/0423bf4292bd494565ef631bc4f2cc7b86b27390), [`0bc289e`](https://github.com/mastra-ai/mastra/commit/0bc289e2d476bf46c5b91c21969e8d0c6864691c), [`9b75a06`](https://github.com/mastra-ai/mastra/commit/9b75a06e53ebb0b950ba7c1e83a0142047185f46), [`4c3a1b1`](https://github.com/mastra-ai/mastra/commit/4c3a1b122ea083e003d71092f30f3b31680b01c0), [`256df35`](https://github.com/mastra-ai/mastra/commit/256df3571d62beb3ad4971faa432927cc140e603), [`b8837ee`](https://github.com/mastra-ai/mastra/commit/b8837ee77e2e84197609762bfabd8b3da326d30c), [`0c57b8b`](https://github.com/mastra-ai/mastra/commit/0c57b8b0a69a97b5a4ae3f79be6c610f29f3cf7b), [`85cc3b3`](https://github.com/mastra-ai/mastra/commit/85cc3b3b6f32ae4b083c26498f50d5b250ba944b), [`3ebdadf`](https://github.com/mastra-ai/mastra/commit/3ebdadfe517d16f29464f35baba8356771160369), [`d567299`](https://github.com/mastra-ai/mastra/commit/d567299cf81e02bd9d5221d4bc05967d6c224161), [`97ea28c`](https://github.com/mastra-ai/mastra/commit/97ea28c746e9e4147d56047bbb1c4a92417a3fec), [`d567299`](https://github.com/mastra-ai/mastra/commit/d567299cf81e02bd9d5221d4bc05967d6c224161), [`716ffe6`](https://github.com/mastra-ai/mastra/commit/716ffe68bed81f7c2690bc8581b9e140f7bf1c3d), [`8296332`](https://github.com/mastra-ai/mastra/commit/8296332de21c16e3dfc3d0b2d615720a6dc88f2f), [`4df2116`](https://github.com/mastra-ai/mastra/commit/4df211619dd922c047d396ca41cd7027c8c4c8e7), [`2219c1a`](https://github.com/mastra-ai/mastra/commit/2219c1acbd21da116da877f0036ffb985a9dd5a3), [`17c4145`](https://github.com/mastra-ai/mastra/commit/17c4145166099354545582335b5252bdfdfd908b)]:
  - @mastra/core@1.11.0
  - @mastra/libsql@1.7.0
  - @mastra/pg@1.8.0
  - @mastra/memory@1.6.2
  - @mastra/mcp@1.1.0

## 0.7.0-alpha.2

### Patch Changes

- Updated dependencies [[`1d0a8a8`](https://github.com/mastra-ai/mastra/commit/1d0a8a8acf33203d5744fc429b090ad8598aa8ed)]:
  - @mastra/core@1.11.0-alpha.2

## 0.7.0-alpha.1

### Patch Changes

- Updated dependencies [[`866cc2c`](https://github.com/mastra-ai/mastra/commit/866cc2cb1f0e3b314afab5194f69477fada745d1), [`6bcbf8a`](https://github.com/mastra-ai/mastra/commit/6bcbf8a6774d5a53b21d61db8a45ce2593ca1616), [`18c3a90`](https://github.com/mastra-ai/mastra/commit/18c3a90c9e48cf69500e308affeb8eba5860b2af), [`f35487b`](https://github.com/mastra-ai/mastra/commit/f35487bb2d46c636e22aa71d90025613ae38235a), [`6dc2192`](https://github.com/mastra-ai/mastra/commit/6dc21921aef0f0efab15cd0805fa3d18f277a76f), [`eeb3a3f`](https://github.com/mastra-ai/mastra/commit/eeb3a3f43aca10cf49479eed2a84b7d9ecea02ba), [`05f8d90`](https://github.com/mastra-ai/mastra/commit/05f8d9009290ce6aa03428b3add635268615db85), [`4b8da97`](https://github.com/mastra-ai/mastra/commit/4b8da97a5ce306e97869df6c39535d9069e563db), [`256df35`](https://github.com/mastra-ai/mastra/commit/256df3571d62beb3ad4971faa432927cc140e603)]:
  - @mastra/core@1.11.0-alpha.1

## 0.7.0-alpha.0

### Minor Changes

- Added headless non-interactive mode via `--prompt` / `-p` flag. Mastra Code can now run from scripts, CI/CD pipelines, and task orchestration systems without human interaction. All blocking interactions (tool approvals, questions, plan approvals, sandbox access) are auto-resolved. Supports `--timeout`, `--continue`, and `--format json` flags. Exit codes: 0 (success), 1 (error/aborted), 2 (timeout). ([#13648](https://github.com/mastra-ai/mastra/pull/13648))

### Patch Changes

- Improve MastraCode image pasting for clipboard images, local image paths, and remote image URLs. ([#13953](https://github.com/mastra-ai/mastra/pull/13953))

- Improved web_search tool rendering in the TUI. Search results now display a clean list of titles and URLs with the search query in the header, instead of dumping raw JSON. ([#13870](https://github.com/mastra-ai/mastra/pull/13870))

- Improved the shell passthrough command (`! <command>`, e.g. `! ls -la`) to show output as it happens. Previously, running a command like `! ping example.com` would show nothing until the command finished. Now, stdout and stderr stream live into a bordered output box with a spinner that resolves to a success or failure indicator on completion. ([#13999](https://github.com/mastra-ai/mastra/pull/13999))

- Subagents now use the same file and command tools as the parent agent, ensuring consistent behavior across sandbox environments and workspaces. ([#13940](https://github.com/mastra-ai/mastra/pull/13940))

- Updated dependencies [[`4f71b43`](https://github.com/mastra-ai/mastra/commit/4f71b436a4a6b8839842d8da47b57b84509af56c), [`a070277`](https://github.com/mastra-ai/mastra/commit/a07027766ce195ba74d0783116d894cbab25d44c), [`b628b91`](https://github.com/mastra-ai/mastra/commit/b628b9128b372c0f54214d902b07279f03443900), [`332c014`](https://github.com/mastra-ai/mastra/commit/332c014e076b81edf7fe45b58205882726415e90), [`6b63153`](https://github.com/mastra-ai/mastra/commit/6b63153878ea841c0f4ce632ba66bb33e57e9c1b), [`c2d7a7c`](https://github.com/mastra-ai/mastra/commit/c2d7a7c48d89245188c81a9a436ad8b1d9f3872d), [`4246e34`](https://github.com/mastra-ai/mastra/commit/4246e34cec9c26636d0965942268e6d07c346671), [`b8837ee`](https://github.com/mastra-ai/mastra/commit/b8837ee77e2e84197609762bfabd8b3da326d30c), [`5d950f7`](https://github.com/mastra-ai/mastra/commit/5d950f7bf426a215a1808f0abef7de5c8336ba1c), [`d3ad589`](https://github.com/mastra-ai/mastra/commit/d3ad589a39e66bb783513c4bbf912246bdf18c22), [`28c85b1`](https://github.com/mastra-ai/mastra/commit/28c85b184fc32b40f7f160483c982da6d388ecbd), [`e9a08fb`](https://github.com/mastra-ai/mastra/commit/e9a08fbef1ada7e50e961e2f54f55e8c10b4a45c), [`57c7391`](https://github.com/mastra-ai/mastra/commit/57c739108b9a6c9160352f0468dfe0428c03a234), [`18d91c3`](https://github.com/mastra-ai/mastra/commit/18d91c3b6e905cfd3ba50e7c7dc81164b6aa69ad), [`631ffd8`](https://github.com/mastra-ai/mastra/commit/631ffd82fed108648b448b28e6a90e38c5f53bf5), [`aae2295`](https://github.com/mastra-ai/mastra/commit/aae2295838a2d329ad6640829e87934790ffe5b8), [`aa61f29`](https://github.com/mastra-ai/mastra/commit/aa61f29ff8095ce46a4ae16e46c4d8c79b2b685b), [`7ff3714`](https://github.com/mastra-ai/mastra/commit/7ff37148515439bb3be009a60e02c3e363299760), [`41d79a1`](https://github.com/mastra-ai/mastra/commit/41d79a14bd8cb6de1e2565fd0a04786bae2f211b), [`e673376`](https://github.com/mastra-ai/mastra/commit/e6733763ad1321aa7e5ae15096b9c2104f93b1f3), [`b2204c9`](https://github.com/mastra-ai/mastra/commit/b2204c98a42848bbfb6f0440f005dc2b6354f1cd), [`a1bf1e3`](https://github.com/mastra-ai/mastra/commit/a1bf1e385ed4c0ef6f11b56c5887442970d127f2), [`b6f647a`](https://github.com/mastra-ai/mastra/commit/b6f647ae2388e091f366581595feb957e37d5b40), [`0c57b8b`](https://github.com/mastra-ai/mastra/commit/0c57b8b0a69a97b5a4ae3f79be6c610f29f3cf7b), [`b081f27`](https://github.com/mastra-ai/mastra/commit/b081f272cf411716e1d6bd72ceac4bcee2657b19), [`682b7f7`](https://github.com/mastra-ai/mastra/commit/682b7f773b7940687ef22569e720fd4bc4fdb8fe), [`0c09eac`](https://github.com/mastra-ai/mastra/commit/0c09eacb1926f64cfdc9ae5c6d63385cf8c9f72c), [`6b9b93d`](https://github.com/mastra-ai/mastra/commit/6b9b93d6f459d1ba6e36f163abf62a085ddb3d64), [`d3ad589`](https://github.com/mastra-ai/mastra/commit/d3ad589a39e66bb783513c4bbf912246bdf18c22), [`b6f647a`](https://github.com/mastra-ai/mastra/commit/b6f647ae2388e091f366581595feb957e37d5b40), [`31b6067`](https://github.com/mastra-ai/mastra/commit/31b6067d0cc3ab10e1b29c36147f3b5266bc714a), [`797ac42`](https://github.com/mastra-ai/mastra/commit/797ac4276de231ad2d694d9aeca75980f6cd0419), [`0423bf4`](https://github.com/mastra-ai/mastra/commit/0423bf4292bd494565ef631bc4f2cc7b86b27390), [`0bc289e`](https://github.com/mastra-ai/mastra/commit/0bc289e2d476bf46c5b91c21969e8d0c6864691c), [`9b75a06`](https://github.com/mastra-ai/mastra/commit/9b75a06e53ebb0b950ba7c1e83a0142047185f46), [`4c3a1b1`](https://github.com/mastra-ai/mastra/commit/4c3a1b122ea083e003d71092f30f3b31680b01c0), [`b8837ee`](https://github.com/mastra-ai/mastra/commit/b8837ee77e2e84197609762bfabd8b3da326d30c), [`0c57b8b`](https://github.com/mastra-ai/mastra/commit/0c57b8b0a69a97b5a4ae3f79be6c610f29f3cf7b), [`85cc3b3`](https://github.com/mastra-ai/mastra/commit/85cc3b3b6f32ae4b083c26498f50d5b250ba944b), [`3ebdadf`](https://github.com/mastra-ai/mastra/commit/3ebdadfe517d16f29464f35baba8356771160369), [`d567299`](https://github.com/mastra-ai/mastra/commit/d567299cf81e02bd9d5221d4bc05967d6c224161), [`97ea28c`](https://github.com/mastra-ai/mastra/commit/97ea28c746e9e4147d56047bbb1c4a92417a3fec), [`d567299`](https://github.com/mastra-ai/mastra/commit/d567299cf81e02bd9d5221d4bc05967d6c224161), [`716ffe6`](https://github.com/mastra-ai/mastra/commit/716ffe68bed81f7c2690bc8581b9e140f7bf1c3d), [`8296332`](https://github.com/mastra-ai/mastra/commit/8296332de21c16e3dfc3d0b2d615720a6dc88f2f), [`4df2116`](https://github.com/mastra-ai/mastra/commit/4df211619dd922c047d396ca41cd7027c8c4c8e7), [`2219c1a`](https://github.com/mastra-ai/mastra/commit/2219c1acbd21da116da877f0036ffb985a9dd5a3), [`17c4145`](https://github.com/mastra-ai/mastra/commit/17c4145166099354545582335b5252bdfdfd908b)]:
  - @mastra/core@1.11.0-alpha.0
  - @mastra/libsql@1.7.0-alpha.0
  - @mastra/pg@1.8.0-alpha.0
  - @mastra/memory@1.6.2-alpha.0
  - @mastra/mcp@1.1.0

## 0.6.0

### Minor Changes

- Added pre/post hook wrapping for tool execution via `HookManager`, exported `createAuthStorage` for standalone auth provider initialization, and fixed Anthropic/OpenAI auth routing to use stored credential type as the source of truth. ([#13611](https://github.com/mastra-ai/mastra/pull/13611))

  **New API: `createAuthStorage`**

  ```ts
  import { createAuthStorage } from 'mastracode';

  const authStorage = createAuthStorage();
  // authStorage is now wired into Claude Max and OpenAI Codex providers
  ```

  - `disabledTools` config now also filters tools exposed to subagents, preventing bypass through delegation
  - Auth routing uses `AuthStorage` credential type (`api_key` vs `oauth`) to correctly route API-key auth vs OAuth bearer auth

- Added /update slash command to check for and install updates directly from the TUI. Fixed update notifications logging repeatedly in the terminal — now only shown once per session. Update messages now reference /update instead of shell commands. ([#13787](https://github.com/mastra-ai/mastra/pull/13787))

### Patch Changes

- Fixed thinking level persistence as a global preference. `/think`, Settings, and OpenAI model pack updates now save the selected level to `settings.json`, so it is kept across restarts and new threads. ([#13748](https://github.com/mastra-ai/mastra/pull/13748))

- Renamed `request_sandbox_access` tool to `request_access`. Fixed tilde paths (`~/.config/...`) not being expanded, which caused the tool to incorrectly report access as already granted. Fixed newly approved paths not being accessible until the next turn by calling `setAllowedPaths` immediately after approval. ([#13753](https://github.com/mastra-ai/mastra/pull/13753))

- Fix fatal "MASTRACODE_VERSION is not defined" error when running from source with tsx. The version constant is now gracefully resolved from package.json at runtime when the build-time define is unavailable. ([#13767](https://github.com/mastra-ai/mastra/pull/13767))

- Updated dependencies [[`41e48c1`](https://github.com/mastra-ai/mastra/commit/41e48c198eee846478e60c02ec432c19d322a517), [`82469d3`](https://github.com/mastra-ai/mastra/commit/82469d3135d5a49dd8dc8feec0ff398b4e0225a0), [`33e2fd5`](https://github.com/mastra-ai/mastra/commit/33e2fd5088f83666df17401e2da68c943dbc0448), [`7ef6e2c`](https://github.com/mastra-ai/mastra/commit/7ef6e2c61be5a42e26f55d15b5902866fc76634f), [`08072ec`](https://github.com/mastra-ai/mastra/commit/08072ec54b5dfe810ed66c0d583ae9d1a9103c11), [`ef9d0f0`](https://github.com/mastra-ai/mastra/commit/ef9d0f0fa98ff225b17afe071f5b84a9258dc142), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`9e21667`](https://github.com/mastra-ai/mastra/commit/9e2166746df81da8f1f933a918741fc52f922c70), [`fa37d39`](https://github.com/mastra-ai/mastra/commit/fa37d39910421feaf8847716292e3d65dd4f30c2), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`1391f22`](https://github.com/mastra-ai/mastra/commit/1391f227ff197080de185ac1073c1d1568c0631f), [`71c38bf`](https://github.com/mastra-ai/mastra/commit/71c38bf905905148ecd0e75c07c1f9825d299b76), [`f993c38`](https://github.com/mastra-ai/mastra/commit/f993c3848c97479b813231be872443bedeced6ab), [`f51849a`](https://github.com/mastra-ai/mastra/commit/f51849a568935122b5100b7ee69704e6d680cf7b), [`3ceb231`](https://github.com/mastra-ai/mastra/commit/3ceb2317aad7da36df5053e7c84f9381eeb68d11), [`9bf3a0d`](https://github.com/mastra-ai/mastra/commit/9bf3a0dac602787925f1762f1f0387d7b4a59620), [`cafa045`](https://github.com/mastra-ai/mastra/commit/cafa0453c9de141ad50c09a13894622dffdd9978), [`1fd9ddb`](https://github.com/mastra-ai/mastra/commit/1fd9ddbb3fe83b281b12bd2e27e426ae86288266), [`1391f22`](https://github.com/mastra-ai/mastra/commit/1391f227ff197080de185ac1073c1d1568c0631f), [`ef888d2`](https://github.com/mastra-ai/mastra/commit/ef888d23c77f85f4c202228b63f8fd9b6d9361af), [`e7a567c`](https://github.com/mastra-ai/mastra/commit/e7a567cfb3e65c955a07d0167cb1b4141f5bda01), [`3626623`](https://github.com/mastra-ai/mastra/commit/36266238eb7db78fce2ac34187194613f6f53733), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443), [`d9d228c`](https://github.com/mastra-ai/mastra/commit/d9d228c0c6ae82ae6ce3b540a3a56b2b1c2b8d98), [`5576507`](https://github.com/mastra-ai/mastra/commit/55765071e360fb97e443aa0a91ccf7e1cd8d92aa), [`79d69c9`](https://github.com/mastra-ai/mastra/commit/79d69c9d5f842ff1c31352fb6026f04c1f6190f3), [`94f44b8`](https://github.com/mastra-ai/mastra/commit/94f44b827ce57b179e50f4916a84c0fa6e7f3b8c), [`13187db`](https://github.com/mastra-ai/mastra/commit/13187dbac880174232dedc5a501ff6c5d0fe59bc), [`2ae5311`](https://github.com/mastra-ai/mastra/commit/2ae531185fff66a80fa165c0999e3d801900e89d), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443)]:
  - @mastra/core@1.10.0
  - @mastra/memory@1.6.1
  - @mastra/mcp@1.1.0
  - @mastra/libsql@1.6.4
  - @mastra/pg@1.7.2

## 0.6.0-alpha.0

### Minor Changes

- Added pre/post hook wrapping for tool execution via `HookManager`, exported `createAuthStorage` for standalone auth provider initialization, and fixed Anthropic/OpenAI auth routing to use stored credential type as the source of truth. ([#13611](https://github.com/mastra-ai/mastra/pull/13611))

  **New API: `createAuthStorage`**

  ```ts
  import { createAuthStorage } from 'mastracode';

  const authStorage = createAuthStorage();
  // authStorage is now wired into Claude Max and OpenAI Codex providers
  ```

  - `disabledTools` config now also filters tools exposed to subagents, preventing bypass through delegation
  - Auth routing uses `AuthStorage` credential type (`api_key` vs `oauth`) to correctly route API-key auth vs OAuth bearer auth

- Added /update slash command to check for and install updates directly from the TUI. Fixed update notifications logging repeatedly in the terminal — now only shown once per session. Update messages now reference /update instead of shell commands. ([#13787](https://github.com/mastra-ai/mastra/pull/13787))

### Patch Changes

- Fixed thinking level persistence as a global preference. `/think`, Settings, and OpenAI model pack updates now save the selected level to `settings.json`, so it is kept across restarts and new threads. ([#13748](https://github.com/mastra-ai/mastra/pull/13748))

- Renamed `request_sandbox_access` tool to `request_access`. Fixed tilde paths (`~/.config/...`) not being expanded, which caused the tool to incorrectly report access as already granted. Fixed newly approved paths not being accessible until the next turn by calling `setAllowedPaths` immediately after approval. ([#13753](https://github.com/mastra-ai/mastra/pull/13753))

- Fix fatal "MASTRACODE_VERSION is not defined" error when running from source with tsx. The version constant is now gracefully resolved from package.json at runtime when the build-time define is unavailable. ([#13767](https://github.com/mastra-ai/mastra/pull/13767))

- Updated dependencies [[`41e48c1`](https://github.com/mastra-ai/mastra/commit/41e48c198eee846478e60c02ec432c19d322a517), [`82469d3`](https://github.com/mastra-ai/mastra/commit/82469d3135d5a49dd8dc8feec0ff398b4e0225a0), [`33e2fd5`](https://github.com/mastra-ai/mastra/commit/33e2fd5088f83666df17401e2da68c943dbc0448), [`7ef6e2c`](https://github.com/mastra-ai/mastra/commit/7ef6e2c61be5a42e26f55d15b5902866fc76634f), [`08072ec`](https://github.com/mastra-ai/mastra/commit/08072ec54b5dfe810ed66c0d583ae9d1a9103c11), [`ef9d0f0`](https://github.com/mastra-ai/mastra/commit/ef9d0f0fa98ff225b17afe071f5b84a9258dc142), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`9e21667`](https://github.com/mastra-ai/mastra/commit/9e2166746df81da8f1f933a918741fc52f922c70), [`fa37d39`](https://github.com/mastra-ai/mastra/commit/fa37d39910421feaf8847716292e3d65dd4f30c2), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`1391f22`](https://github.com/mastra-ai/mastra/commit/1391f227ff197080de185ac1073c1d1568c0631f), [`71c38bf`](https://github.com/mastra-ai/mastra/commit/71c38bf905905148ecd0e75c07c1f9825d299b76), [`f993c38`](https://github.com/mastra-ai/mastra/commit/f993c3848c97479b813231be872443bedeced6ab), [`f51849a`](https://github.com/mastra-ai/mastra/commit/f51849a568935122b5100b7ee69704e6d680cf7b), [`3ceb231`](https://github.com/mastra-ai/mastra/commit/3ceb2317aad7da36df5053e7c84f9381eeb68d11), [`9bf3a0d`](https://github.com/mastra-ai/mastra/commit/9bf3a0dac602787925f1762f1f0387d7b4a59620), [`cafa045`](https://github.com/mastra-ai/mastra/commit/cafa0453c9de141ad50c09a13894622dffdd9978), [`1fd9ddb`](https://github.com/mastra-ai/mastra/commit/1fd9ddbb3fe83b281b12bd2e27e426ae86288266), [`1391f22`](https://github.com/mastra-ai/mastra/commit/1391f227ff197080de185ac1073c1d1568c0631f), [`ef888d2`](https://github.com/mastra-ai/mastra/commit/ef888d23c77f85f4c202228b63f8fd9b6d9361af), [`e7a567c`](https://github.com/mastra-ai/mastra/commit/e7a567cfb3e65c955a07d0167cb1b4141f5bda01), [`3626623`](https://github.com/mastra-ai/mastra/commit/36266238eb7db78fce2ac34187194613f6f53733), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443), [`d9d228c`](https://github.com/mastra-ai/mastra/commit/d9d228c0c6ae82ae6ce3b540a3a56b2b1c2b8d98), [`5576507`](https://github.com/mastra-ai/mastra/commit/55765071e360fb97e443aa0a91ccf7e1cd8d92aa), [`79d69c9`](https://github.com/mastra-ai/mastra/commit/79d69c9d5f842ff1c31352fb6026f04c1f6190f3), [`94f44b8`](https://github.com/mastra-ai/mastra/commit/94f44b827ce57b179e50f4916a84c0fa6e7f3b8c), [`13187db`](https://github.com/mastra-ai/mastra/commit/13187dbac880174232dedc5a501ff6c5d0fe59bc), [`2ae5311`](https://github.com/mastra-ai/mastra/commit/2ae531185fff66a80fa165c0999e3d801900e89d), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443)]:
  - @mastra/core@1.10.0-alpha.0
  - @mastra/memory@1.6.1-alpha.0
  - @mastra/mcp@1.1.0-alpha.0
  - @mastra/libsql@1.6.4-alpha.0
  - @mastra/pg@1.7.2-alpha.0

## 0.5.1

### Patch Changes

- Fixed fatal 'Cannot find module ../../package.json' error when running mastracode after installing from npm. The version is now inlined at build time instead of requiring the package.json file at runtime. ([#13760](https://github.com/mastra-ai/mastra/pull/13760))

## 0.5.1-alpha.0

### Patch Changes

- Fixed fatal 'Cannot find module ../../package.json' error when running mastracode after installing from npm. The version is now inlined at build time instead of requiring the package.json file at runtime. ([#13760](https://github.com/mastra-ai/mastra/pull/13760))

## 0.5.0

### Minor Changes

- Added support for dynamic `extraTools` in `createMastraCode`. The `extraTools` option now accepts a function `({ requestContext }) => Record<string, any>` in addition to a static record, enabling conditional tool registration based on the current request context (e.g. model, mode). ([#13713](https://github.com/mastra-ai/mastra/pull/13713))

- Added plan persistence: approved plans are now saved as markdown files to disk. Plans are stored at the platform-specific app data directory (e.g. ~/Library/Application Support/mastracode/plans/ on macOS). Set the MASTRA_PLANS_DIR environment variable to override the storage location. ([#13557](https://github.com/mastra-ai/mastra/pull/13557))

- Added `resolveModel` to the return value of `createMastraCode`, allowing consumers to use the fully-authenticated model resolver instead of having to reimplement provider logic locally. ([#13716](https://github.com/mastra-ai/mastra/pull/13716))

  ```typescript
  const { harness, resolveModel } = await createMastraCode({ cwd: projectPath });
  const model = resolveModel('anthropic/claude-sonnet-4-20250514');
  ```

- Added /report-issue slash command. Starts a guided conversation to help you file a well-structured bug report — the LLM interviews you about the problem, gathers environment info, checks for duplicates, and drafts the issue for your approval before creating it. ([#13605](https://github.com/mastra-ai/mastra/pull/13605))

- Fix assistant streaming updates so tool-result-only chunks do not overwrite visible assistant text with empty content. ([#13609](https://github.com/mastra-ai/mastra/pull/13609))

  Also add an OpenAI native `web_search` fallback when no Tavily key is configured and the current model is `openai/*`.

- Support HTTP MCP servers in mastracode config ([#13613](https://github.com/mastra-ai/mastra/pull/13613))

  MCP server entries with a `url` field are now recognized as HTTP (Streamable HTTP / SSE) servers. Previously only stdio-based servers (with `command`) were loaded from `mcp.json`; entries with `url` were silently dropped.

  **What's new:**
  - Add `url` + optional `headers` config for HTTP MCP servers
  - Invalid or ambiguous entries are tracked as "skipped" with a human-readable reason
  - `/mcp` command shows transport type (`[stdio]` / `[http]`) and lists skipped servers
  - Startup logs report skipped servers with reasons

  **Example mcp.json:**

  ```json
  {
    "mcpServers": {
      "local-fs": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
      },
      "remote-api": {
        "url": "https://mcp.example.com/sse",
        "headers": { "Authorization": "Bearer <token>" }
      }
    }
  }
  ```

- Added auto-update prompt on session start. When a newer version is available on npm, you'll be prompted to update automatically. Declining saves the choice so the prompt won't repeat — a one-liner with the manual update command is shown instead. The update command matches the package manager used for installation (npm, pnpm, yarn, bun). ([#13603](https://github.com/mastra-ai/mastra/pull/13603))

### Patch Changes

- Fixed plan approval flow so selecting Request changes keeps the submitted plan visible while entering feedback in the TUI. ([#13598](https://github.com/mastra-ai/mastra/pull/13598))

- Removed unnecessary Mastra instance wrapper in createMastraCode. The Agent is now created standalone and the Harness handles Mastra registration internally during init(). ([#13519](https://github.com/mastra-ai/mastra/pull/13519))

- **Added** Ctrl+Z now suspends mastracode and returns control to your shell. Run `fg` to resume. ([#13723](https://github.com/mastra-ai/mastra/pull/13723))

  ```bash
  # while mastracode is running, press Ctrl+Z to suspend
  $ fg   # resume mastracode
  ```

  Fixes #13582.

- Added `/clone` command with confirm/cancel and optional rename prompts. Thread selector now sorts threads tagged with the current directory above other same-resource threads. Auto-resume shows thread selector when multiple directory threads exist instead of silently picking the most recent. Thread lock prompts now include a "Switch thread" option to open the thread selector. ([#13569](https://github.com/mastra-ai/mastra/pull/13569))

- Fixed test suite reliability by resolving cross-test module contamination when running with shared isolation ([#13692](https://github.com/mastra-ai/mastra/pull/13692))

- Add first-class custom provider support for MastraCode model selection and routing. ([#13682](https://github.com/mastra-ai/mastra/pull/13682))
  - Add `/custom-providers` command to create, edit, and delete custom OpenAI-compatible providers and manage model IDs under each provider.
  - Persist custom providers and model IDs in `settings.json` with schema parsing/validation updates.
  - Extend Harness model catalog listing with `customModelCatalogProvider` so custom models appear in existing selectors (`/models`, `/subagents`).
  - Route configured custom provider model IDs through `ModelRouterLanguageModel` using provider-specific URL and optional API key settings.

- Added ANTHROPIC_API_KEY support as a fallback for Anthropic model resolution. Previously, anthropic/\* models always required Claude Max OAuth. Now, when not logged in via OAuth, mastracode falls back to the ANTHROPIC_API_KEY environment variable or a stored API key credential. ([#13600](https://github.com/mastra-ai/mastra/pull/13600))

- Fixed an issue where multiple interactive prompts could appear at once and make earlier prompts unresponsive. Prompts are now shown one at a time so each can be answered reliably. ([#13696](https://github.com/mastra-ai/mastra/pull/13696))

- Fixed OpenAI Codex OAuth model routing for observational memory. ([#13563](https://github.com/mastra-ai/mastra/pull/13563))

  When Codex OAuth is active, observer and reflector model IDs now remap GPT-5 OpenAI models to Codex-compatible variants before provider resolution. This prevents observational memory runs from failing when a non-codex GPT-5 model ID is selected.

  Also enforced a minimum reasoning level of `low` for GPT-5 Codex requests so `off` is not sent to Codex for those models.

- The setup flow now detects API keys for all providers listed in the model registry, not just a fixed set. ([#13566](https://github.com/mastra-ai/mastra/pull/13566))
  Users with API keys for providers like Groq, Mistral, or any supported provider will no longer see a "No model providers configured" error.
  Missing provider detection is now a warning, allowing users to continue setup.

- **`sendMessage` now accepts `files` instead of `images`**, supporting any file type with optional `filename`. ([#13574](https://github.com/mastra-ai/mastra/pull/13574))

  **Breaking change:** Rename `images` to `files` when calling `harness.sendMessage()`:

  ```ts
  // Before
  await harness.sendMessage({
    content: 'Analyze this',
    images: [{ data: base64Data, mimeType: 'image/png' }],
  });

  // After
  await harness.sendMessage({
    content: 'Analyze this',
    files: [{ data: base64Data, mediaType: 'image/png', filename: 'screenshot.png' }],
  });
  ```

  - `files` accepts `{ data, mediaType, filename? }` — filenames are now preserved through storage and message history
  - Text-based files (`text/*`, `application/json`) are automatically decoded to readable text content instead of being sent as binary, which models could not process
  - `HarnessMessageContent` now includes a `file` type, so file parts round-trip correctly through message history

- Fixed two bugs in Mastra Code tool handling: ([#13564](https://github.com/mastra-ai/mastra/pull/13564))

  **extraTools not merged** — The `extraTools` parameter in `createMastraCode` was accepted but never passed through to the dynamic tool builder. Extra tools are now correctly merged into the tool set (without overwriting built-in tools).

  **Denied tools still advertised** — Tools with a per-tool `deny` policy in `permissionRules` were still included in the tool set and system prompt guidance, causing the model to attempt using them only to be blocked at execution time. Denied tools are now filtered from both the tool set and the tool guidance, so the model never sees them.

- Added "Quiet mode" setting. When enabled via `/settings` → "Quiet mode" → On, components like subagent output auto-collapse to compact summary lines on completion. Default is off (full output stays visible). The setting persists across restarts. ([#13556](https://github.com/mastra-ai/mastra/pull/13556))

- Added Ctrl+V clipboard paste support for both images and text. Images from the clipboard are detected and sent to the AI agent. Text pastes flow through the editor's paste handling, which condenses large pastes (>10 lines) into a compact `[paste #N +X lines]` marker instead of dumping raw content. ([#13712](https://github.com/mastra-ai/mastra/pull/13712))

- Fixed subagents being unable to access files outside the project root. Subagents now inherit both user-approved sandbox paths and skill paths (e.g. `~/.claude/skills`) from the parent agent. ([#13700](https://github.com/mastra-ai/mastra/pull/13700))

- Improved the `/resource` command. Switching resources now resumes the most recent thread for that resource instead of always creating a new one. If no threads exist for the resource, a new thread is created. Also added help text clarifying how resource switching works. ([#13690](https://github.com/mastra-ai/mastra/pull/13690))

  Example:

  ```bash
  /resource my-resource-id
  ```

- Workspace tool names are now remapped to canonical names (`view`, `search_content`, `string_replace_lsp`, etc.) so they match tool guidance prompts, permissions, and TUI rendering. ([#13687](https://github.com/mastra-ai/mastra/pull/13687))

- Ability to pass in your own workspace to createMastraCode ([#13693](https://github.com/mastra-ai/mastra/pull/13693))

- Fixed mastracode edit tools to resolve relative paths against the configured project root. ([#13526](https://github.com/mastra-ai/mastra/pull/13526))

- Model pack selection is now more consistent and reliable in mastracode. ([#13512](https://github.com/mastra-ai/mastra/pull/13512))
  - `/models` is now the single command for choosing and managing model packs.
  - Model picker ranking now learns from your recent selections and keeps those preferences across sessions.
  - Pack choice now restores correctly per thread when switching between threads.
  - Custom packs now support full create, rename, targeted edit, and delete workflows.
  - The built-in **Varied** option has been retired; users who had it selected are automatically migrated to a saved custom pack named `varied`.

- Fixed a crash where ERR_STREAM_DESTROYED errors would fatally exit the process. These errors occur routinely during cancelled LLM streams, LSP shutdown, or killed subprocesses and are now silently ignored instead of crashing mastracode. ([#13560](https://github.com/mastra-ai/mastra/pull/13560))

- Fixed tool guidance to match actual workspace tool parameters: view uses offset/limit, search_content uses path, string_replace_lsp uses old_string/new_string with replace_all, execute_command documents tail parameter and cwd. Softened overly strict NEVER directives to prefer-style guidance. ([#13724](https://github.com/mastra-ai/mastra/pull/13724))

- Switched Mastra Code to workspace tools and enabled LSP by default ([#13437](https://github.com/mastra-ai/mastra/pull/13437))
  - Switched from built-in tool implementations to workspace tools for file operations, search, edit, write, and command execution
  - Enabled LSP (language server) by default with automatic package runner detection and bundled binary resolution
  - Added real-time stdout/stderr streaming in the TUI for workspace command execution
  - Added TUI rendering for process management tools (view output, kill processes)
  - Fixed edit diff preview in the TUI to work with workspace tool arg names (`old_string`/`new_string`)

- Added MASTRA_DEBUG environment variable to gate debug.log file writing. When MASTRA_DEBUG=true is set, console.error and console.warn output is captured to a debug.log file in the app data directory. The log file is automatically truncated to ~4 MB on startup if it exceeds 5 MB, preventing unbounded disk usage over time. ([#13691](https://github.com/mastra-ai/mastra/pull/13691))

- Updated dependencies [[`504fc8b`](https://github.com/mastra-ai/mastra/commit/504fc8b9d0ddab717577ad3bf9c95ea4bd5377bd), [`f9c150b`](https://github.com/mastra-ai/mastra/commit/f9c150b7595ad05ad9cc9a11098e2944361e8c22), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`edee4b3`](https://github.com/mastra-ai/mastra/commit/edee4b37dff0af515fc7cc0e8d71ee39e6a762f0), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`3790c75`](https://github.com/mastra-ai/mastra/commit/3790c7578cc6a47d854eb12d89e6b1912867fe29), [`e7a235b`](https://github.com/mastra-ai/mastra/commit/e7a235be6472e0c870ed6c791ddb17c492dc188b), [`d51d298`](https://github.com/mastra-ai/mastra/commit/d51d298953967aab1f58ec965b644d109214f085), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`d5f0d8d`](https://github.com/mastra-ai/mastra/commit/d5f0d8d6a03e515ddaa9b5da19b7e44b8357b07b), [`09c3b18`](https://github.com/mastra-ai/mastra/commit/09c3b1802ff14e243a8a8baea327440bc8cc2e32), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`85c84eb`](https://github.com/mastra-ai/mastra/commit/85c84ebb78aebfcba9d209c8e152b16d7a00cb71), [`a89272a`](https://github.com/mastra-ai/mastra/commit/a89272a5d71939b9fcd284e6a6dc1dd091a6bdcf), [`ee9c8df`](https://github.com/mastra-ai/mastra/commit/ee9c8df644f19d055af5f496bf4942705f5a47b7), [`77b4a25`](https://github.com/mastra-ai/mastra/commit/77b4a254e51907f8ff3a3ba95596a18e93ae4b35), [`276246e`](https://github.com/mastra-ai/mastra/commit/276246e0b9066a1ea48bbc70df84dbe528daaf99), [`08ecfdb`](https://github.com/mastra-ai/mastra/commit/08ecfdbdad6fb8285deef86a034bdf4a6047cfca), [`d5f628c`](https://github.com/mastra-ai/mastra/commit/d5f628ca86c6f6f3ff1035d52f635df32dd81cab), [`24f7204`](https://github.com/mastra-ai/mastra/commit/24f72046eb35b47c75d36193af4fb817b588720d), [`359d687`](https://github.com/mastra-ai/mastra/commit/359d687527ab95a79e0ec0487dcecec8d9c7c7dc), [`524c0f3`](https://github.com/mastra-ai/mastra/commit/524c0f3c434c3d9d18f66338dcef383d6161b59c), [`961b7ba`](https://github.com/mastra-ai/mastra/commit/961b7baa2c61365e1ee1b33d2a5074102ee40a52), [`c18a0e9`](https://github.com/mastra-ai/mastra/commit/c18a0e9cef1e4ca004b2963d35e4cfc031971eac), [`4bd21ea`](https://github.com/mastra-ai/mastra/commit/4bd21ea43d44d0a0427414fc047577f9f0aa3bec), [`115a7a4`](https://github.com/mastra-ai/mastra/commit/115a7a47db5e9896fec12ae6507501adb9ec89bf), [`22a48ae`](https://github.com/mastra-ai/mastra/commit/22a48ae2513eb54d8d79dad361fddbca97a155e8), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9e77e8f`](https://github.com/mastra-ai/mastra/commit/9e77e8f0e823ef58cb448dd1f390fce987a101f3), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`7edf78f`](https://github.com/mastra-ai/mastra/commit/7edf78f80422c43e84585f08ba11df0d4d0b73c5), [`1c4221c`](https://github.com/mastra-ai/mastra/commit/1c4221cf6032ec98d0e094d4ee11da3e48490d96), [`d25b9ea`](https://github.com/mastra-ai/mastra/commit/d25b9eabd400167255a97b690ffbc4ee4097ded5), [`fe1ce5c`](https://github.com/mastra-ai/mastra/commit/fe1ce5c9211c03d561606fda95cbfe7df1d9a9b5), [`b03c0e0`](https://github.com/mastra-ai/mastra/commit/b03c0e0389a799523929a458b0509c9e4244d562), [`0a8366b`](https://github.com/mastra-ai/mastra/commit/0a8366b0a692fcdde56c4d526e4cf03c502ae4ac), [`56f2018`](https://github.com/mastra-ai/mastra/commit/56f2018cb38969c11933e815a5f70cf631d3964a), [`85664e9`](https://github.com/mastra-ai/mastra/commit/85664e9fd857320fbc245e301f764f45f66f32a3), [`bc79650`](https://github.com/mastra-ai/mastra/commit/bc796500c6e0334faa158a96077e3fb332274869), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`3a3a59e`](https://github.com/mastra-ai/mastra/commit/3a3a59e8ffaa6a985fe3d9a126a3f5ade11a6724), [`3108d4e`](https://github.com/mastra-ai/mastra/commit/3108d4e649c9fddbf03253a6feeb388a5fa9fa5a), [`0c33b2c`](https://github.com/mastra-ai/mastra/commit/0c33b2c9db537f815e1c59e2c898ffce2e395a79), [`191e5bd`](https://github.com/mastra-ai/mastra/commit/191e5bd29b82f5bda35243945790da7bc7b695c2), [`fde104d`](https://github.com/mastra-ai/mastra/commit/fde104da80935d6e0dd24327e86a51011fcb3173), [`f77cd94`](https://github.com/mastra-ai/mastra/commit/f77cd94c44eabed490384e7d19232a865e13214c), [`e8135c7`](https://github.com/mastra-ai/mastra/commit/e8135c7e300dac5040670eec7eab896ac6092e30), [`daca48f`](https://github.com/mastra-ai/mastra/commit/daca48f0fb17b7ae0b62a2ac40cf0e491b2fd0b7), [`257d14f`](https://github.com/mastra-ai/mastra/commit/257d14faca5931f2e4186fc165b6f0b1f915deee), [`352f25d`](https://github.com/mastra-ai/mastra/commit/352f25da316b24cdd5b410fd8dddf6a8b763da2a), [`93477d0`](https://github.com/mastra-ai/mastra/commit/93477d0769b8a13ea5ed73d508d967fb23eaeed9), [`31c78b3`](https://github.com/mastra-ai/mastra/commit/31c78b3eb28f58a8017f1dcc795c33214d87feac), [`0bc0720`](https://github.com/mastra-ai/mastra/commit/0bc07201095791858087cc56f353fcd65e87ab54), [`36516ac`](https://github.com/mastra-ai/mastra/commit/36516aca1021cbeb42e74751b46a2614101f37c8), [`e947652`](https://github.com/mastra-ai/mastra/commit/e9476527fdecb4449e54570e80dfaf8466901254), [`23b43dd`](https://github.com/mastra-ai/mastra/commit/23b43ddd0e3db05dee828c2733faa2496b7b0319), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`ec248f6`](https://github.com/mastra-ai/mastra/commit/ec248f6b56e8a037c066c49b2178e2507471d988)]:
  - @mastra/core@1.9.0
  - @mastra/libsql@1.6.3
  - @mastra/pg@1.7.1
  - @mastra/memory@1.6.0
  - @mastra/mcp@1.0.3

## 0.5.0-alpha.0

### Minor Changes

- Added support for dynamic `extraTools` in `createMastraCode`. The `extraTools` option now accepts a function `({ requestContext }) => Record<string, any>` in addition to a static record, enabling conditional tool registration based on the current request context (e.g. model, mode). ([#13713](https://github.com/mastra-ai/mastra/pull/13713))

- Added plan persistence: approved plans are now saved as markdown files to disk. Plans are stored at the platform-specific app data directory (e.g. ~/Library/Application Support/mastracode/plans/ on macOS). Set the MASTRA_PLANS_DIR environment variable to override the storage location. ([#13557](https://github.com/mastra-ai/mastra/pull/13557))

- Added `resolveModel` to the return value of `createMastraCode`, allowing consumers to use the fully-authenticated model resolver instead of having to reimplement provider logic locally. ([#13716](https://github.com/mastra-ai/mastra/pull/13716))

  ```typescript
  const { harness, resolveModel } = await createMastraCode({ cwd: projectPath });
  const model = resolveModel('anthropic/claude-sonnet-4-20250514');
  ```

- Added /report-issue slash command. Starts a guided conversation to help you file a well-structured bug report — the LLM interviews you about the problem, gathers environment info, checks for duplicates, and drafts the issue for your approval before creating it. ([#13605](https://github.com/mastra-ai/mastra/pull/13605))

- Fix assistant streaming updates so tool-result-only chunks do not overwrite visible assistant text with empty content. ([#13609](https://github.com/mastra-ai/mastra/pull/13609))

  Also add an OpenAI native `web_search` fallback when no Tavily key is configured and the current model is `openai/*`.

- Support HTTP MCP servers in mastracode config ([#13613](https://github.com/mastra-ai/mastra/pull/13613))

  MCP server entries with a `url` field are now recognized as HTTP (Streamable HTTP / SSE) servers. Previously only stdio-based servers (with `command`) were loaded from `mcp.json`; entries with `url` were silently dropped.

  **What's new:**
  - Add `url` + optional `headers` config for HTTP MCP servers
  - Invalid or ambiguous entries are tracked as "skipped" with a human-readable reason
  - `/mcp` command shows transport type (`[stdio]` / `[http]`) and lists skipped servers
  - Startup logs report skipped servers with reasons

  **Example mcp.json:**

  ```json
  {
    "mcpServers": {
      "local-fs": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
      },
      "remote-api": {
        "url": "https://mcp.example.com/sse",
        "headers": { "Authorization": "Bearer <token>" }
      }
    }
  }
  ```

- Added auto-update prompt on session start. When a newer version is available on npm, you'll be prompted to update automatically. Declining saves the choice so the prompt won't repeat — a one-liner with the manual update command is shown instead. The update command matches the package manager used for installation (npm, pnpm, yarn, bun). ([#13603](https://github.com/mastra-ai/mastra/pull/13603))

### Patch Changes

- Fixed plan approval flow so selecting Request changes keeps the submitted plan visible while entering feedback in the TUI. ([#13598](https://github.com/mastra-ai/mastra/pull/13598))

- Removed unnecessary Mastra instance wrapper in createMastraCode. The Agent is now created standalone and the Harness handles Mastra registration internally during init(). ([#13519](https://github.com/mastra-ai/mastra/pull/13519))

- **Added** Ctrl+Z now suspends mastracode and returns control to your shell. Run `fg` to resume. ([#13723](https://github.com/mastra-ai/mastra/pull/13723))

  ```bash
  # while mastracode is running, press Ctrl+Z to suspend
  $ fg   # resume mastracode
  ```

  Fixes #13582.

- Added `/clone` command with confirm/cancel and optional rename prompts. Thread selector now sorts threads tagged with the current directory above other same-resource threads. Auto-resume shows thread selector when multiple directory threads exist instead of silently picking the most recent. Thread lock prompts now include a "Switch thread" option to open the thread selector. ([#13569](https://github.com/mastra-ai/mastra/pull/13569))

- Fixed test suite reliability by resolving cross-test module contamination when running with shared isolation ([#13692](https://github.com/mastra-ai/mastra/pull/13692))

- Add first-class custom provider support for MastraCode model selection and routing. ([#13682](https://github.com/mastra-ai/mastra/pull/13682))
  - Add `/custom-providers` command to create, edit, and delete custom OpenAI-compatible providers and manage model IDs under each provider.
  - Persist custom providers and model IDs in `settings.json` with schema parsing/validation updates.
  - Extend Harness model catalog listing with `customModelCatalogProvider` so custom models appear in existing selectors (`/models`, `/subagents`).
  - Route configured custom provider model IDs through `ModelRouterLanguageModel` using provider-specific URL and optional API key settings.

- Added ANTHROPIC_API_KEY support as a fallback for Anthropic model resolution. Previously, anthropic/\* models always required Claude Max OAuth. Now, when not logged in via OAuth, mastracode falls back to the ANTHROPIC_API_KEY environment variable or a stored API key credential. ([#13600](https://github.com/mastra-ai/mastra/pull/13600))

- Fixed an issue where multiple interactive prompts could appear at once and make earlier prompts unresponsive. Prompts are now shown one at a time so each can be answered reliably. ([#13696](https://github.com/mastra-ai/mastra/pull/13696))

- Fixed OpenAI Codex OAuth model routing for observational memory. ([#13563](https://github.com/mastra-ai/mastra/pull/13563))

  When Codex OAuth is active, observer and reflector model IDs now remap GPT-5 OpenAI models to Codex-compatible variants before provider resolution. This prevents observational memory runs from failing when a non-codex GPT-5 model ID is selected.

  Also enforced a minimum reasoning level of `low` for GPT-5 Codex requests so `off` is not sent to Codex for those models.

- The setup flow now detects API keys for all providers listed in the model registry, not just a fixed set. ([#13566](https://github.com/mastra-ai/mastra/pull/13566))
  Users with API keys for providers like Groq, Mistral, or any supported provider will no longer see a "No model providers configured" error.
  Missing provider detection is now a warning, allowing users to continue setup.

- **`sendMessage` now accepts `files` instead of `images`**, supporting any file type with optional `filename`. ([#13574](https://github.com/mastra-ai/mastra/pull/13574))

  **Breaking change:** Rename `images` to `files` when calling `harness.sendMessage()`:

  ```ts
  // Before
  await harness.sendMessage({
    content: 'Analyze this',
    images: [{ data: base64Data, mimeType: 'image/png' }],
  });

  // After
  await harness.sendMessage({
    content: 'Analyze this',
    files: [{ data: base64Data, mediaType: 'image/png', filename: 'screenshot.png' }],
  });
  ```

  - `files` accepts `{ data, mediaType, filename? }` — filenames are now preserved through storage and message history
  - Text-based files (`text/*`, `application/json`) are automatically decoded to readable text content instead of being sent as binary, which models could not process
  - `HarnessMessageContent` now includes a `file` type, so file parts round-trip correctly through message history

- Fixed two bugs in Mastra Code tool handling: ([#13564](https://github.com/mastra-ai/mastra/pull/13564))

  **extraTools not merged** — The `extraTools` parameter in `createMastraCode` was accepted but never passed through to the dynamic tool builder. Extra tools are now correctly merged into the tool set (without overwriting built-in tools).

  **Denied tools still advertised** — Tools with a per-tool `deny` policy in `permissionRules` were still included in the tool set and system prompt guidance, causing the model to attempt using them only to be blocked at execution time. Denied tools are now filtered from both the tool set and the tool guidance, so the model never sees them.

- Added "Quiet mode" setting. When enabled via `/settings` → "Quiet mode" → On, components like subagent output auto-collapse to compact summary lines on completion. Default is off (full output stays visible). The setting persists across restarts. ([#13556](https://github.com/mastra-ai/mastra/pull/13556))

- Added Ctrl+V clipboard paste support for both images and text. Images from the clipboard are detected and sent to the AI agent. Text pastes flow through the editor's paste handling, which condenses large pastes (>10 lines) into a compact `[paste #N +X lines]` marker instead of dumping raw content. ([#13712](https://github.com/mastra-ai/mastra/pull/13712))

- Fixed subagents being unable to access files outside the project root. Subagents now inherit both user-approved sandbox paths and skill paths (e.g. `~/.claude/skills`) from the parent agent. ([#13700](https://github.com/mastra-ai/mastra/pull/13700))

- Improved the `/resource` command. Switching resources now resumes the most recent thread for that resource instead of always creating a new one. If no threads exist for the resource, a new thread is created. Also added help text clarifying how resource switching works. ([#13690](https://github.com/mastra-ai/mastra/pull/13690))

  Example:

  ```bash
  /resource my-resource-id
  ```

- Workspace tool names are now remapped to canonical names (`view`, `search_content`, `string_replace_lsp`, etc.) so they match tool guidance prompts, permissions, and TUI rendering. ([#13687](https://github.com/mastra-ai/mastra/pull/13687))

- Ability to pass in your own workspace to createMastraCode ([#13693](https://github.com/mastra-ai/mastra/pull/13693))

- Fixed mastracode edit tools to resolve relative paths against the configured project root. ([#13526](https://github.com/mastra-ai/mastra/pull/13526))

- Model pack selection is now more consistent and reliable in mastracode. ([#13512](https://github.com/mastra-ai/mastra/pull/13512))
  - `/models` is now the single command for choosing and managing model packs.
  - Model picker ranking now learns from your recent selections and keeps those preferences across sessions.
  - Pack choice now restores correctly per thread when switching between threads.
  - Custom packs now support full create, rename, targeted edit, and delete workflows.
  - The built-in **Varied** option has been retired; users who had it selected are automatically migrated to a saved custom pack named `varied`.

- Fixed a crash where ERR_STREAM_DESTROYED errors would fatally exit the process. These errors occur routinely during cancelled LLM streams, LSP shutdown, or killed subprocesses and are now silently ignored instead of crashing mastracode. ([#13560](https://github.com/mastra-ai/mastra/pull/13560))

- Fixed tool guidance to match actual workspace tool parameters: view uses offset/limit, search_content uses path, string_replace_lsp uses old_string/new_string with replace_all, execute_command documents tail parameter and cwd. Softened overly strict NEVER directives to prefer-style guidance. ([#13724](https://github.com/mastra-ai/mastra/pull/13724))

- Switched Mastra Code to workspace tools and enabled LSP by default ([#13437](https://github.com/mastra-ai/mastra/pull/13437))
  - Switched from built-in tool implementations to workspace tools for file operations, search, edit, write, and command execution
  - Enabled LSP (language server) by default with automatic package runner detection and bundled binary resolution
  - Added real-time stdout/stderr streaming in the TUI for workspace command execution
  - Added TUI rendering for process management tools (view output, kill processes)
  - Fixed edit diff preview in the TUI to work with workspace tool arg names (`old_string`/`new_string`)

- Added MASTRA_DEBUG environment variable to gate debug.log file writing. When MASTRA_DEBUG=true is set, console.error and console.warn output is captured to a debug.log file in the app data directory. The log file is automatically truncated to ~4 MB on startup if it exceeds 5 MB, preventing unbounded disk usage over time. ([#13691](https://github.com/mastra-ai/mastra/pull/13691))

- Updated dependencies [[`504fc8b`](https://github.com/mastra-ai/mastra/commit/504fc8b9d0ddab717577ad3bf9c95ea4bd5377bd), [`f9c150b`](https://github.com/mastra-ai/mastra/commit/f9c150b7595ad05ad9cc9a11098e2944361e8c22), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`edee4b3`](https://github.com/mastra-ai/mastra/commit/edee4b37dff0af515fc7cc0e8d71ee39e6a762f0), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`3790c75`](https://github.com/mastra-ai/mastra/commit/3790c7578cc6a47d854eb12d89e6b1912867fe29), [`e7a235b`](https://github.com/mastra-ai/mastra/commit/e7a235be6472e0c870ed6c791ddb17c492dc188b), [`d51d298`](https://github.com/mastra-ai/mastra/commit/d51d298953967aab1f58ec965b644d109214f085), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`d5f0d8d`](https://github.com/mastra-ai/mastra/commit/d5f0d8d6a03e515ddaa9b5da19b7e44b8357b07b), [`09c3b18`](https://github.com/mastra-ai/mastra/commit/09c3b1802ff14e243a8a8baea327440bc8cc2e32), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`85c84eb`](https://github.com/mastra-ai/mastra/commit/85c84ebb78aebfcba9d209c8e152b16d7a00cb71), [`a89272a`](https://github.com/mastra-ai/mastra/commit/a89272a5d71939b9fcd284e6a6dc1dd091a6bdcf), [`ee9c8df`](https://github.com/mastra-ai/mastra/commit/ee9c8df644f19d055af5f496bf4942705f5a47b7), [`77b4a25`](https://github.com/mastra-ai/mastra/commit/77b4a254e51907f8ff3a3ba95596a18e93ae4b35), [`276246e`](https://github.com/mastra-ai/mastra/commit/276246e0b9066a1ea48bbc70df84dbe528daaf99), [`08ecfdb`](https://github.com/mastra-ai/mastra/commit/08ecfdbdad6fb8285deef86a034bdf4a6047cfca), [`d5f628c`](https://github.com/mastra-ai/mastra/commit/d5f628ca86c6f6f3ff1035d52f635df32dd81cab), [`24f7204`](https://github.com/mastra-ai/mastra/commit/24f72046eb35b47c75d36193af4fb817b588720d), [`359d687`](https://github.com/mastra-ai/mastra/commit/359d687527ab95a79e0ec0487dcecec8d9c7c7dc), [`524c0f3`](https://github.com/mastra-ai/mastra/commit/524c0f3c434c3d9d18f66338dcef383d6161b59c), [`961b7ba`](https://github.com/mastra-ai/mastra/commit/961b7baa2c61365e1ee1b33d2a5074102ee40a52), [`c18a0e9`](https://github.com/mastra-ai/mastra/commit/c18a0e9cef1e4ca004b2963d35e4cfc031971eac), [`4bd21ea`](https://github.com/mastra-ai/mastra/commit/4bd21ea43d44d0a0427414fc047577f9f0aa3bec), [`115a7a4`](https://github.com/mastra-ai/mastra/commit/115a7a47db5e9896fec12ae6507501adb9ec89bf), [`22a48ae`](https://github.com/mastra-ai/mastra/commit/22a48ae2513eb54d8d79dad361fddbca97a155e8), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9e77e8f`](https://github.com/mastra-ai/mastra/commit/9e77e8f0e823ef58cb448dd1f390fce987a101f3), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`7edf78f`](https://github.com/mastra-ai/mastra/commit/7edf78f80422c43e84585f08ba11df0d4d0b73c5), [`1c4221c`](https://github.com/mastra-ai/mastra/commit/1c4221cf6032ec98d0e094d4ee11da3e48490d96), [`d25b9ea`](https://github.com/mastra-ai/mastra/commit/d25b9eabd400167255a97b690ffbc4ee4097ded5), [`fe1ce5c`](https://github.com/mastra-ai/mastra/commit/fe1ce5c9211c03d561606fda95cbfe7df1d9a9b5), [`b03c0e0`](https://github.com/mastra-ai/mastra/commit/b03c0e0389a799523929a458b0509c9e4244d562), [`0a8366b`](https://github.com/mastra-ai/mastra/commit/0a8366b0a692fcdde56c4d526e4cf03c502ae4ac), [`56f2018`](https://github.com/mastra-ai/mastra/commit/56f2018cb38969c11933e815a5f70cf631d3964a), [`85664e9`](https://github.com/mastra-ai/mastra/commit/85664e9fd857320fbc245e301f764f45f66f32a3), [`bc79650`](https://github.com/mastra-ai/mastra/commit/bc796500c6e0334faa158a96077e3fb332274869), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`3a3a59e`](https://github.com/mastra-ai/mastra/commit/3a3a59e8ffaa6a985fe3d9a126a3f5ade11a6724), [`3108d4e`](https://github.com/mastra-ai/mastra/commit/3108d4e649c9fddbf03253a6feeb388a5fa9fa5a), [`0c33b2c`](https://github.com/mastra-ai/mastra/commit/0c33b2c9db537f815e1c59e2c898ffce2e395a79), [`191e5bd`](https://github.com/mastra-ai/mastra/commit/191e5bd29b82f5bda35243945790da7bc7b695c2), [`fde104d`](https://github.com/mastra-ai/mastra/commit/fde104da80935d6e0dd24327e86a51011fcb3173), [`f77cd94`](https://github.com/mastra-ai/mastra/commit/f77cd94c44eabed490384e7d19232a865e13214c), [`e8135c7`](https://github.com/mastra-ai/mastra/commit/e8135c7e300dac5040670eec7eab896ac6092e30), [`daca48f`](https://github.com/mastra-ai/mastra/commit/daca48f0fb17b7ae0b62a2ac40cf0e491b2fd0b7), [`257d14f`](https://github.com/mastra-ai/mastra/commit/257d14faca5931f2e4186fc165b6f0b1f915deee), [`352f25d`](https://github.com/mastra-ai/mastra/commit/352f25da316b24cdd5b410fd8dddf6a8b763da2a), [`93477d0`](https://github.com/mastra-ai/mastra/commit/93477d0769b8a13ea5ed73d508d967fb23eaeed9), [`31c78b3`](https://github.com/mastra-ai/mastra/commit/31c78b3eb28f58a8017f1dcc795c33214d87feac), [`0bc0720`](https://github.com/mastra-ai/mastra/commit/0bc07201095791858087cc56f353fcd65e87ab54), [`36516ac`](https://github.com/mastra-ai/mastra/commit/36516aca1021cbeb42e74751b46a2614101f37c8), [`e947652`](https://github.com/mastra-ai/mastra/commit/e9476527fdecb4449e54570e80dfaf8466901254), [`23b43dd`](https://github.com/mastra-ai/mastra/commit/23b43ddd0e3db05dee828c2733faa2496b7b0319), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`ec248f6`](https://github.com/mastra-ai/mastra/commit/ec248f6b56e8a037c066c49b2178e2507471d988)]:
  - @mastra/core@1.9.0-alpha.0
  - @mastra/libsql@1.6.3-alpha.0
  - @mastra/pg@1.7.1-alpha.0
  - @mastra/memory@1.6.0-alpha.0
  - @mastra/mcp@1.0.3-alpha.0

## 0.4.0

### Minor Changes

- Added light theme support and automatic terminal theme detection. Mastra Code now detects your terminal's color scheme and applies a matching dark or light theme. Use the new `/theme` slash command to switch between `auto`, `dark`, and `light` modes. The choice is persisted across sessions. You can also set the `MASTRA_THEME` environment variable to override the detected theme. ([#13487](https://github.com/mastra-ai/mastra/pull/13487))

  ```sh
  # Switch theme at runtime via slash command
  /theme auto    # detect from terminal background
  /theme dark    # force dark theme
  /theme light   # force light theme

  # Or override via environment variable
  MASTRA_THEME=light mastracode
  ```

- Added reasoning effort support for OpenAI Codex models. The `/think` command now controls the reasoning depth (off, low, medium, high, xhigh) sent to the Codex API via the `reasoningEffort` parameter. Without this, gpt-5.3-codex skips tool calls and narrates instead of acting. ([#13490](https://github.com/mastra-ai/mastra/pull/13490))

  **Other improvements:**
  - `/think` now shows an inline selector list when run without arguments, or accepts a level directly (e.g. `/think high`)
  - Dropped `minimal` level (was redundantly mapping to same API value as `low`)
  - Added `xhigh` level for GPT-5.2+ and Codex models
  - Provider-specific values (e.g. `none`, `xhigh`) shown next to labels when an OpenAI model is selected
  - Switching to an OpenAI model pack auto-enables reasoning at `low` if it was off
  - Updated default Codex model from gpt-5.2 to gpt-5.3
  - Shows a warning when the current model doesn't support reasoning

### Patch Changes

- Added Claude Max OAuth warning for Anthropic authentication ([#13505](https://github.com/mastra-ai/mastra/pull/13505))

  A warning now appears when authenticating with Anthropic via OAuth, alerting that using a Claude Max subscription through OAuth is a grey area that may violate Anthropic's Terms of Service.
  - During `/login` or onboarding: **Continue** proceeds with OAuth, **Cancel** returns to the provider selection screen.
  - At startup (when existing Anthropic OAuth credentials are detected and the warning has not been acknowledged): **Continue** keeps credentials, **Remove OAuth** logs out from Anthropic.
  - The startup warning only appears once — acknowledging it persists the choice in settings.

- Fixed `/skills` so it lists skills even before the first message is sent. ([#13457](https://github.com/mastra-ai/mastra/pull/13457))

- Fixed `@` file autocomplete so fuzzy file search works when `fd` or `fdfind` is installed. ([#13460](https://github.com/mastra-ai/mastra/pull/13460))

- Fixed onboarding to allow API-key-only setup without requiring OAuth login. Previously, users with API keys configured as environment variables were blocked at the model pack selection step if they skipped OAuth login during onboarding. The auth step now clearly indicates that OAuth is optional when API keys are set. ([#13500](https://github.com/mastra-ai/mastra/pull/13500))

- Updated default observational memory settings: bufferTokens 1/5, bufferActivation 2000, blockAfter 2. ([#13476](https://github.com/mastra-ai/mastra/pull/13476))

- Fixed a fatal crash on startup that caused the TUI to fail immediately on launch. ([#13503](https://github.com/mastra-ai/mastra/pull/13503))

- Fixed stale git branch in system prompt and TUI status bar. The branch is now refreshed on every agent request and when switching threads, so both the system prompt and status bar reflect the current branch. Also improved the status line to show abbreviated branch names instead of hiding the branch entirely when the name is too long. ([#13456](https://github.com/mastra-ai/mastra/pull/13456))

- Fixed Mastra Code TUI hook triggering so `Stop` runs on every `agent_end` reason (`complete`, `aborted`, `error`) and `UserPromptSubmit` runs before sending non-command user prompts with block handling. ([#13442](https://github.com/mastra-ai/mastra/pull/13442))

- Updated thinking-level labels in Mastra Code UI to be provider-aware for OpenAI models. ([#13490](https://github.com/mastra-ai/mastra/pull/13490))
  - `/think` and Settings now use shared label metadata
  - OpenAI models show provider-specific labels (for example, `Very High (xhigh)`)
  - Stored `thinkingLevel` values remain unchanged (`off`, `low`, `medium`, `high`, `xhigh`)

- Strengthened the Anthropic Claude Max OAuth warning language to explicitly call out account-ban risk and potential Terms of Service violations before users continue with OAuth. ([#13508](https://github.com/mastra-ai/mastra/pull/13508))

- Fixed slash command arguments being silently discarded when the command template doesn't use $ARGUMENTS or positional variables ($1, $2, etc.). Arguments are now appended to the output so the model can see what the user provided. ([#13493](https://github.com/mastra-ai/mastra/pull/13493))

- Updated dependencies [[`df170fd`](https://github.com/mastra-ai/mastra/commit/df170fd139b55f845bfd2de8488b16435bd3d0da), [`ae55343`](https://github.com/mastra-ai/mastra/commit/ae5534397fc006fd6eef3e4f80c235bcdc9289ef), [`b8621e2`](https://github.com/mastra-ai/mastra/commit/b8621e25e70cae69a9343353f878a9112493a2fe), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`f03e794`](https://github.com/mastra-ai/mastra/commit/f03e794630f812b56e95aad54f7b1993dc003add), [`aa4a5ae`](https://github.com/mastra-ai/mastra/commit/aa4a5aedb80d8d6837bab8cbb2e301215d1ba3e9), [`de3f584`](https://github.com/mastra-ai/mastra/commit/de3f58408752a8d80a295275c7f23fc306cf7f4f), [`74ae019`](https://github.com/mastra-ai/mastra/commit/74ae0197a6895f8897c369038c643d7e32dd84c2), [`d3fb010`](https://github.com/mastra-ai/mastra/commit/d3fb010c98f575f1c0614452667396e2653815f6), [`702ee1c`](https://github.com/mastra-ai/mastra/commit/702ee1c41be67cc532b4dbe89bcb62143508f6f0), [`f495051`](https://github.com/mastra-ai/mastra/commit/f495051eb6496a720f637fc85b6d69941c12554c), [`60b45e0`](https://github.com/mastra-ai/mastra/commit/60b45e0af29485c69f70f77b15d6643aaa5a9da7), [`e622f1d`](https://github.com/mastra-ai/mastra/commit/e622f1d3ab346a8e6aca6d1fe2eac99bd961e50b), [`861f111`](https://github.com/mastra-ai/mastra/commit/861f11189211b20ddb70d8df81a6b901fc78d11e), [`00f43e8`](https://github.com/mastra-ai/mastra/commit/00f43e8e97a80c82b27d5bd30494f10a715a1df9), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`96a1702`](https://github.com/mastra-ai/mastra/commit/96a1702ce362c50dda20c8b4a228b4ad1a36a17a), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`114e7c1`](https://github.com/mastra-ai/mastra/commit/114e7c146ac682925f0fb37376c1be70e5d6e6e5), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`72df4a8`](https://github.com/mastra-ai/mastra/commit/72df4a8f9bf1a20cfd3d9006a4fdb597ad56d10a)]:
  - @mastra/core@1.8.0
  - @mastra/mcp@1.0.2
  - @mastra/pg@1.7.0
  - @mastra/libsql@1.6.2
  - @mastra/memory@1.5.2

## 0.4.0-alpha.0

### Minor Changes

- Added light theme support and automatic terminal theme detection. Mastra Code now detects your terminal's color scheme and applies a matching dark or light theme. Use the new `/theme` slash command to switch between `auto`, `dark`, and `light` modes. The choice is persisted across sessions. You can also set the `MASTRA_THEME` environment variable to override the detected theme. ([#13487](https://github.com/mastra-ai/mastra/pull/13487))

  ```sh
  # Switch theme at runtime via slash command
  /theme auto    # detect from terminal background
  /theme dark    # force dark theme
  /theme light   # force light theme

  # Or override via environment variable
  MASTRA_THEME=light mastracode
  ```

- Added reasoning effort support for OpenAI Codex models. The `/think` command now controls the reasoning depth (off, low, medium, high, xhigh) sent to the Codex API via the `reasoningEffort` parameter. Without this, gpt-5.3-codex skips tool calls and narrates instead of acting. ([#13490](https://github.com/mastra-ai/mastra/pull/13490))

  **Other improvements:**
  - `/think` now shows an inline selector list when run without arguments, or accepts a level directly (e.g. `/think high`)
  - Dropped `minimal` level (was redundantly mapping to same API value as `low`)
  - Added `xhigh` level for GPT-5.2+ and Codex models
  - Provider-specific values (e.g. `none`, `xhigh`) shown next to labels when an OpenAI model is selected
  - Switching to an OpenAI model pack auto-enables reasoning at `low` if it was off
  - Updated default Codex model from gpt-5.2 to gpt-5.3
  - Shows a warning when the current model doesn't support reasoning

### Patch Changes

- Added Claude Max OAuth warning for Anthropic authentication ([#13505](https://github.com/mastra-ai/mastra/pull/13505))

  A warning now appears when authenticating with Anthropic via OAuth, alerting that using a Claude Max subscription through OAuth is a grey area that may violate Anthropic's Terms of Service.
  - During `/login` or onboarding: **Continue** proceeds with OAuth, **Cancel** returns to the provider selection screen.
  - At startup (when existing Anthropic OAuth credentials are detected and the warning has not been acknowledged): **Continue** keeps credentials, **Remove OAuth** logs out from Anthropic.
  - The startup warning only appears once — acknowledging it persists the choice in settings.

- Fixed `/skills` so it lists skills even before the first message is sent. ([#13457](https://github.com/mastra-ai/mastra/pull/13457))

- Fixed `@` file autocomplete so fuzzy file search works when `fd` or `fdfind` is installed. ([#13460](https://github.com/mastra-ai/mastra/pull/13460))

- Fixed onboarding to allow API-key-only setup without requiring OAuth login. Previously, users with API keys configured as environment variables were blocked at the model pack selection step if they skipped OAuth login during onboarding. The auth step now clearly indicates that OAuth is optional when API keys are set. ([#13500](https://github.com/mastra-ai/mastra/pull/13500))

- Updated default observational memory settings: bufferTokens 1/5, bufferActivation 2000, blockAfter 2. ([#13476](https://github.com/mastra-ai/mastra/pull/13476))

- Fixed a fatal crash on startup that caused the TUI to fail immediately on launch. ([#13503](https://github.com/mastra-ai/mastra/pull/13503))

- Fixed stale git branch in system prompt and TUI status bar. The branch is now refreshed on every agent request and when switching threads, so both the system prompt and status bar reflect the current branch. Also improved the status line to show abbreviated branch names instead of hiding the branch entirely when the name is too long. ([#13456](https://github.com/mastra-ai/mastra/pull/13456))

- Fixed Mastra Code TUI hook triggering so `Stop` runs on every `agent_end` reason (`complete`, `aborted`, `error`) and `UserPromptSubmit` runs before sending non-command user prompts with block handling. ([#13442](https://github.com/mastra-ai/mastra/pull/13442))

- Updated thinking-level labels in Mastra Code UI to be provider-aware for OpenAI models. ([#13490](https://github.com/mastra-ai/mastra/pull/13490))
  - `/think` and Settings now use shared label metadata
  - OpenAI models show provider-specific labels (for example, `Very High (xhigh)`)
  - Stored `thinkingLevel` values remain unchanged (`off`, `low`, `medium`, `high`, `xhigh`)

- Strengthened the Anthropic Claude Max OAuth warning language to explicitly call out account-ban risk and potential Terms of Service violations before users continue with OAuth. ([#13508](https://github.com/mastra-ai/mastra/pull/13508))

- Fixed slash command arguments being silently discarded when the command template doesn't use $ARGUMENTS or positional variables ($1, $2, etc.). Arguments are now appended to the output so the model can see what the user provided. ([#13493](https://github.com/mastra-ai/mastra/pull/13493))

- Updated dependencies [[`df170fd`](https://github.com/mastra-ai/mastra/commit/df170fd139b55f845bfd2de8488b16435bd3d0da), [`ae55343`](https://github.com/mastra-ai/mastra/commit/ae5534397fc006fd6eef3e4f80c235bcdc9289ef), [`b8621e2`](https://github.com/mastra-ai/mastra/commit/b8621e25e70cae69a9343353f878a9112493a2fe), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`f03e794`](https://github.com/mastra-ai/mastra/commit/f03e794630f812b56e95aad54f7b1993dc003add), [`aa4a5ae`](https://github.com/mastra-ai/mastra/commit/aa4a5aedb80d8d6837bab8cbb2e301215d1ba3e9), [`de3f584`](https://github.com/mastra-ai/mastra/commit/de3f58408752a8d80a295275c7f23fc306cf7f4f), [`74ae019`](https://github.com/mastra-ai/mastra/commit/74ae0197a6895f8897c369038c643d7e32dd84c2), [`d3fb010`](https://github.com/mastra-ai/mastra/commit/d3fb010c98f575f1c0614452667396e2653815f6), [`702ee1c`](https://github.com/mastra-ai/mastra/commit/702ee1c41be67cc532b4dbe89bcb62143508f6f0), [`f495051`](https://github.com/mastra-ai/mastra/commit/f495051eb6496a720f637fc85b6d69941c12554c), [`60b45e0`](https://github.com/mastra-ai/mastra/commit/60b45e0af29485c69f70f77b15d6643aaa5a9da7), [`e622f1d`](https://github.com/mastra-ai/mastra/commit/e622f1d3ab346a8e6aca6d1fe2eac99bd961e50b), [`861f111`](https://github.com/mastra-ai/mastra/commit/861f11189211b20ddb70d8df81a6b901fc78d11e), [`00f43e8`](https://github.com/mastra-ai/mastra/commit/00f43e8e97a80c82b27d5bd30494f10a715a1df9), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`96a1702`](https://github.com/mastra-ai/mastra/commit/96a1702ce362c50dda20c8b4a228b4ad1a36a17a), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`114e7c1`](https://github.com/mastra-ai/mastra/commit/114e7c146ac682925f0fb37376c1be70e5d6e6e5), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`72df4a8`](https://github.com/mastra-ai/mastra/commit/72df4a8f9bf1a20cfd3d9006a4fdb597ad56d10a)]:
  - @mastra/core@1.8.0-alpha.0
  - @mastra/mcp@1.0.2-alpha.0
  - @mastra/pg@1.7.0-alpha.0
  - @mastra/libsql@1.6.2-alpha.0
  - @mastra/memory@1.5.2-alpha.0

## 0.3.0

### Minor Changes

- Added interactive onboarding flow for first-time setup ([#13421](https://github.com/mastra-ai/mastra/pull/13421))

  **Setup wizard** — On first launch, an interactive wizard guides you through:
  - Authenticating with AI providers (Claude Max, OpenAI Codex)
  - Choosing a model pack (Varied, Anthropic, OpenAI, or Custom)
  - Selecting an observational memory model
  - Enabling or disabling YOLO mode (auto-approve tool calls)

  **Global settings** — Your preferences are now saved to `settings.json` in the app data directory and automatically applied to new threads. Model pack selections reference pack IDs so you get new model versions automatically.

  **Custom model packs** — Choose "Custom" to pick a specific model for each mode (plan/build/fast). Saved custom packs appear when re-running `/setup`.

  **`/setup` command** — Re-run the setup wizard anytime. Previously chosen options are highlighted with "(current)" indicators.

  **Settings migration** — Model-related data previously stored in `auth.json` (`_modelRanks`, `_modeModelId_*`, `_subagentModelId*`) is automatically migrated to `settings.json` on first load.

- Added storage backend configuration to `/settings` with PostgreSQL opt-in and remote LibSQL support. ([#13435](https://github.com/mastra-ai/mastra/pull/13435))

  **Selecting a backend**

  Switch storage backends through the `/settings` command (Storage backend option) or by setting the `MASTRA_STORAGE_BACKEND` environment variable. LibSQL remains the default — no changes needed for existing setups. Both backends prompt for a connection URL interactively after selection.

  **Remote LibSQL (Turso)**

  Select LibSQL in `/settings` and enter a remote Turso URL (e.g. `libsql://your-db.turso.io`). Leave empty to keep the default local file database. Can also be set via environment variable:

  ```sh
  export MASTRA_DB_URL="libsql://your-db.turso.io"
  export MASTRA_DB_AUTH_TOKEN="your-token"
  ```

  **PostgreSQL configuration**

  Select PostgreSQL in `/settings` and enter a connection string, or configure via environment variables:

  ```sh
  export MASTRA_STORAGE_BACKEND=pg
  export MASTRA_PG_CONNECTION_STRING="postgresql://user:pass@localhost:5432/db"
  ```

  If the PostgreSQL connection fails on startup, mastracode falls back to the local LibSQL database and shows a warning so you can fix the connection via `/settings`.

  Optional PostgreSQL settings include `schemaName`, `disableInit`, and `skipDefaultIndexes`.

- Added model name to Co-Authored-By in commit messages. Commits now include the active model (e.g. `Co-Authored-By: Mastra Code (anthropic/claude-opus-4-6) <noreply@mastra.ai>`) for traceability when switching between models. Falls back to the original static format when no model is set. ([#13376](https://github.com/mastra-ai/mastra/pull/13376))

### Patch Changes

- Fixed plan mode agent to properly call submit_plan tool. The agent was generating text descriptions instead of calling the tool. Fixed by: creating dynamic mode-specific tool guidance with correct tool names, clarifying tool vs text usage with explicit exceptions for communication tools, and strengthening submit_plan call instructions with urgent language and code examples. ([#13416](https://github.com/mastra-ai/mastra/pull/13416))

- Updated `/cost` and `/diff` commands to read token usage, memory progress, and modified files from the Harness display state instead of maintaining separate local copies. Moved shared type definitions (`OMProgressState`, `OMStatus`, `OMBufferedStatus`) to `@mastra/core/harness` and re-exported them for backward compatibility. ([#13427](https://github.com/mastra-ai/mastra/pull/13427))

- Exclude hidden files from directory listings ([#13384](https://github.com/mastra-ai/mastra/pull/13384))

- Consolidated keyboard shortcuts and commands into a `/help` overlay. The header now shows a compact hint line (`⇧Tab mode · /help info & shortcuts`) instead of 3 lines of keybinding instructions. Running `/help` opens a styled overlay with all commands and shortcuts. ([#13426](https://github.com/mastra-ai/mastra/pull/13426))

- Improved TUI maintainability by modularizing the main TUI class into focused modules: event handlers, command dispatchers, status line rendering, message rendering, error display, shell passthrough, and setup logic. Reduced the main TUI file from ~4,760 lines to 449 lines with no changes to user-facing behavior. ([#13413](https://github.com/mastra-ai/mastra/pull/13413))

- Added styled ASCII art banner header to the TUI with purple gradient and project frontmatter display. The banner shows "MASTRA CODE" in block letters for wide terminals, "MASTRA" for medium terminals, and falls back to a compact single line for narrow terminals. Project info (name, resource ID, branch, user) now renders inside the TUI header instead of via console.info before startup. ([#13422](https://github.com/mastra-ai/mastra/pull/13422))

- LSP now shows correct diagnostics for TypeScript and JavaScript files ([#13385](https://github.com/mastra-ai/mastra/pull/13385))

- Updated dependencies [[`551dc24`](https://github.com/mastra-ai/mastra/commit/551dc2445ffb6efa05eb268e8ab700bcd34ed39c), [`e8afc44`](https://github.com/mastra-ai/mastra/commit/e8afc44a41f24ffe8b8ae4a5ee27cfddbe7934a6), [`24284ff`](https://github.com/mastra-ai/mastra/commit/24284ffae306ddf0ab83273e13f033520839ef40), [`f5097cc`](https://github.com/mastra-ai/mastra/commit/f5097cc8a813c82c3378882c31178320cadeb655), [`71e237f`](https://github.com/mastra-ai/mastra/commit/71e237fa852a3ad9a50a3ddb3b5f3b20b9a8181c), [`c2e02f1`](https://github.com/mastra-ai/mastra/commit/c2e02f181843cbda8db6fd893adce85edc0f8742), [`13a291e`](https://github.com/mastra-ai/mastra/commit/13a291ebb9f9bca80befa0d9166b916bb348e8e9), [`397af5a`](https://github.com/mastra-ai/mastra/commit/397af5a69f34d4157f51a7c8da3f1ded1e1d611c), [`d4701f7`](https://github.com/mastra-ai/mastra/commit/d4701f7e24822b081b70f9c806c39411b1a712e7), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`6184727`](https://github.com/mastra-ai/mastra/commit/6184727e812bf7a65cee209bacec3a2f5a16e923), [`0c338b8`](https://github.com/mastra-ai/mastra/commit/0c338b87362dcd95ff8191ca00df645b6953f534), [`6f6385b`](https://github.com/mastra-ai/mastra/commit/6f6385be5b33687cd21e71fc27e972e6928bb34c), [`14aba61`](https://github.com/mastra-ai/mastra/commit/14aba61b9cff76d72bc7ef6f3a83ae2c5d059193), [`dd9dd1c`](https://github.com/mastra-ai/mastra/commit/dd9dd1c9ae32ae79093f8c4adde1732ac6357233)]:
  - @mastra/libsql@1.6.1
  - @mastra/pg@1.6.1
  - @mastra/memory@1.5.1
  - @mastra/core@1.7.0

## 0.3.0-alpha.0

### Minor Changes

- Added interactive onboarding flow for first-time setup ([#13421](https://github.com/mastra-ai/mastra/pull/13421))

  **Setup wizard** — On first launch, an interactive wizard guides you through:
  - Authenticating with AI providers (Claude Max, OpenAI Codex)
  - Choosing a model pack (Varied, Anthropic, OpenAI, or Custom)
  - Selecting an observational memory model
  - Enabling or disabling YOLO mode (auto-approve tool calls)

  **Global settings** — Your preferences are now saved to `settings.json` in the app data directory and automatically applied to new threads. Model pack selections reference pack IDs so you get new model versions automatically.

  **Custom model packs** — Choose "Custom" to pick a specific model for each mode (plan/build/fast). Saved custom packs appear when re-running `/setup`.

  **`/setup` command** — Re-run the setup wizard anytime. Previously chosen options are highlighted with "(current)" indicators.

  **Settings migration** — Model-related data previously stored in `auth.json` (`_modelRanks`, `_modeModelId_*`, `_subagentModelId*`) is automatically migrated to `settings.json` on first load.

- Added storage backend configuration to `/settings` with PostgreSQL opt-in and remote LibSQL support. ([#13435](https://github.com/mastra-ai/mastra/pull/13435))

  **Selecting a backend**

  Switch storage backends through the `/settings` command (Storage backend option) or by setting the `MASTRA_STORAGE_BACKEND` environment variable. LibSQL remains the default — no changes needed for existing setups. Both backends prompt for a connection URL interactively after selection.

  **Remote LibSQL (Turso)**

  Select LibSQL in `/settings` and enter a remote Turso URL (e.g. `libsql://your-db.turso.io`). Leave empty to keep the default local file database. Can also be set via environment variable:

  ```sh
  export MASTRA_DB_URL="libsql://your-db.turso.io"
  export MASTRA_DB_AUTH_TOKEN="your-token"
  ```

  **PostgreSQL configuration**

  Select PostgreSQL in `/settings` and enter a connection string, or configure via environment variables:

  ```sh
  export MASTRA_STORAGE_BACKEND=pg
  export MASTRA_PG_CONNECTION_STRING="postgresql://user:pass@localhost:5432/db"
  ```

  If the PostgreSQL connection fails on startup, mastracode falls back to the local LibSQL database and shows a warning so you can fix the connection via `/settings`.

  Optional PostgreSQL settings include `schemaName`, `disableInit`, and `skipDefaultIndexes`.

- Added model name to Co-Authored-By in commit messages. Commits now include the active model (e.g. `Co-Authored-By: Mastra Code (anthropic/claude-opus-4-6) <noreply@mastra.ai>`) for traceability when switching between models. Falls back to the original static format when no model is set. ([#13376](https://github.com/mastra-ai/mastra/pull/13376))

### Patch Changes

- Fixed plan mode agent to properly call submit_plan tool. The agent was generating text descriptions instead of calling the tool. Fixed by: creating dynamic mode-specific tool guidance with correct tool names, clarifying tool vs text usage with explicit exceptions for communication tools, and strengthening submit_plan call instructions with urgent language and code examples. ([#13416](https://github.com/mastra-ai/mastra/pull/13416))

- Updated `/cost` and `/diff` commands to read token usage, memory progress, and modified files from the Harness display state instead of maintaining separate local copies. Moved shared type definitions (`OMProgressState`, `OMStatus`, `OMBufferedStatus`) to `@mastra/core/harness` and re-exported them for backward compatibility. ([#13427](https://github.com/mastra-ai/mastra/pull/13427))

- Exclude hidden files from directory listings ([#13384](https://github.com/mastra-ai/mastra/pull/13384))

- Consolidated keyboard shortcuts and commands into a `/help` overlay. The header now shows a compact hint line (`⇧Tab mode · /help info & shortcuts`) instead of 3 lines of keybinding instructions. Running `/help` opens a styled overlay with all commands and shortcuts. ([#13426](https://github.com/mastra-ai/mastra/pull/13426))

- Improved TUI maintainability by modularizing the main TUI class into focused modules: event handlers, command dispatchers, status line rendering, message rendering, error display, shell passthrough, and setup logic. Reduced the main TUI file from ~4,760 lines to 449 lines with no changes to user-facing behavior. ([#13413](https://github.com/mastra-ai/mastra/pull/13413))

- Added styled ASCII art banner header to the TUI with purple gradient and project frontmatter display. The banner shows "MASTRA CODE" in block letters for wide terminals, "MASTRA" for medium terminals, and falls back to a compact single line for narrow terminals. Project info (name, resource ID, branch, user) now renders inside the TUI header instead of via console.info before startup. ([#13422](https://github.com/mastra-ai/mastra/pull/13422))

- LSP now shows correct diagnostics for TypeScript and JavaScript files ([#13385](https://github.com/mastra-ai/mastra/pull/13385))

- Updated dependencies [[`551dc24`](https://github.com/mastra-ai/mastra/commit/551dc2445ffb6efa05eb268e8ab700bcd34ed39c), [`e8afc44`](https://github.com/mastra-ai/mastra/commit/e8afc44a41f24ffe8b8ae4a5ee27cfddbe7934a6), [`24284ff`](https://github.com/mastra-ai/mastra/commit/24284ffae306ddf0ab83273e13f033520839ef40), [`f5097cc`](https://github.com/mastra-ai/mastra/commit/f5097cc8a813c82c3378882c31178320cadeb655), [`71e237f`](https://github.com/mastra-ai/mastra/commit/71e237fa852a3ad9a50a3ddb3b5f3b20b9a8181c), [`c2e02f1`](https://github.com/mastra-ai/mastra/commit/c2e02f181843cbda8db6fd893adce85edc0f8742), [`13a291e`](https://github.com/mastra-ai/mastra/commit/13a291ebb9f9bca80befa0d9166b916bb348e8e9), [`397af5a`](https://github.com/mastra-ai/mastra/commit/397af5a69f34d4157f51a7c8da3f1ded1e1d611c), [`d4701f7`](https://github.com/mastra-ai/mastra/commit/d4701f7e24822b081b70f9c806c39411b1a712e7), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`6184727`](https://github.com/mastra-ai/mastra/commit/6184727e812bf7a65cee209bacec3a2f5a16e923), [`6f6385b`](https://github.com/mastra-ai/mastra/commit/6f6385be5b33687cd21e71fc27e972e6928bb34c), [`14aba61`](https://github.com/mastra-ai/mastra/commit/14aba61b9cff76d72bc7ef6f3a83ae2c5d059193), [`dd9dd1c`](https://github.com/mastra-ai/mastra/commit/dd9dd1c9ae32ae79093f8c4adde1732ac6357233)]:
  - @mastra/libsql@1.6.1-alpha.0
  - @mastra/pg@1.6.1-alpha.0
  - @mastra/memory@1.5.1-alpha.0
  - @mastra/core@1.7.0-alpha.0

## 0.2.0

### Minor Changes

- Added streaming tool argument previews across all tool renderers. Tool names, file paths, and commands now appear immediately as the model generates them, rather than waiting for the complete tool call. ([#13328](https://github.com/mastra-ai/mastra/pull/13328))
  - **Generic tools** show live key/value argument previews as args stream in
  - **Edit tool** renders a bordered diff preview as soon as `old_str` and `new_str` are available, even before the tool result arrives
  - **Write tool** streams syntax-highlighted file content in a bordered box while args arrive
  - **Find files** shows the glob pattern in the pending header
  - **Task write** streams items directly into the pinned task list component in real-time

  All tools use partial JSON parsing to progressively display argument information. This is enabled automatically for all Harness-based agents — no configuration required.

### Patch Changes

- Improved subagent usage guidance: subagents are now only recommended when spawning multiple in parallel, and the main agent must verify all subagent output before proceeding. ([#13339](https://github.com/mastra-ai/mastra/pull/13339))

- Updated TUI to work with the new Harness object-parameter API, ensuring all commands, approvals, and thread flows continue to function correctly. ([#13353](https://github.com/mastra-ai/mastra/pull/13353))

- Added audit-tests subagent that reviews test quality in a branch. The parent agent passes a description of the branch work along with changed files to this read-only subagent, which explores existing test conventions then audits for behavioral coverage, intent-vs-test alignment, LLM-generated test slop, redundant assertions, file organization, and missing edge cases. ([#13331](https://github.com/mastra-ai/mastra/pull/13331))

- Fixed the `/mcp` slash command always showing "MCP system not initialized" even when MCP servers were configured and working. Server status and `/mcp reload` now work as expected. ([#13311](https://github.com/mastra-ai/mastra/pull/13311))

- Improved Observational Memory activation timing by halving the buffer interval when approaching the activation threshold, producing finer-grained chunks for more precise context management. ([#13357](https://github.com/mastra-ai/mastra/pull/13357))

- Fixed stale OAuth credentials when resolving the OpenAI Codex model. Auth storage is now reloaded before each model resolution, preventing authentication failures after token refresh. ([#13307](https://github.com/mastra-ai/mastra/pull/13307))

- Improved TUI composability for external consumers by exposing a structured `TUIState` interface and `createTUIState` factory. ([#13350](https://github.com/mastra-ai/mastra/pull/13350))

- Added AGENTS.md to the instruction file loader so projects created by create-mastra are automatically picked up. Removed support for the deprecated AGENT.md (singular) convention. ([#13346](https://github.com/mastra-ai/mastra/pull/13346))

- Fixed an issue where memory activation could shrink the message window too aggressively due to a token counting inaccuracy, resulting in very small context windows (~300 tokens). Temporarily raised the buffer activation threshold to prevent this. ([#13349](https://github.com/mastra-ai/mastra/pull/13349))

- Fixed assistant message text disappearing when todo_write tool calls were made during streaming ([#13335](https://github.com/mastra-ai/mastra/pull/13335))

- Fixed the view tool to gracefully handle view_range when viewing directories. Previously, passing view_range with a directory path would throw an error, and passing undefined values would fail schema validation. Now, view_range slices the directory listing to show a subset of entries, enabling pagination through large directories. ([#13355](https://github.com/mastra-ai/mastra/pull/13355))

- Updated README with current installation instructions for npm, pnpm, and Homebrew. ([#13294](https://github.com/mastra-ai/mastra/pull/13294))

- Simplified the MCP management API by replacing the `MCPManager` class with a `createMcpManager()` factory function. All existing behavior (TUI `/mcp` command, tool collection, config merging) is preserved. ([#13347](https://github.com/mastra-ai/mastra/pull/13347))

- **@mastra/core:** Added optional `threadLock` callbacks to `HarnessConfig` for preventing concurrent thread access across processes. The Harness calls `acquire`/`release` during `selectOrCreateThread`, `createThread`, and `switchThread` when configured. Locking is opt-in — when `threadLock` is not provided, behavior is unchanged. ([#13334](https://github.com/mastra-ai/mastra/pull/13334))

  ```ts
  const harness = new Harness({
    id: 'my-harness',
    storage: myStore,
    modes: [{ id: 'default', agent: myAgent }],
    threadLock: {
      acquire: threadId => acquireThreadLock(threadId),
      release: threadId => releaseThreadLock(threadId),
    },
  });
  ```

  **mastracode:** Wires the existing filesystem-based thread lock (`thread-lock.ts`) into the new `threadLock` config, restoring the concurrent access protection that was lost during the monorepo migration.

- Migrated from todo_write/todo_check tools to the new built-in task_write/task_check tools from @mastra/core/harness. Renamed all todo terminology to task across prompts, TUI components, and agent configurations. ([#13344](https://github.com/mastra-ai/mastra/pull/13344))

- Fixed Observational Memory status not updating during conversations. The harness was missing streaming handlers for OM data chunks (status, observation start/end, buffering, activation), so the TUI never received real-time OM progress updates. Also added switchObserverModel and switchReflectorModel methods so changing OM models properly emits events to subscribers. ([#13330](https://github.com/mastra-ai/mastra/pull/13330))

- Fixed Ctrl+F follow-up queueing to resolve autocomplete suggestions before reading editor text, so partially typed slash commands (e.g. /rev) are expanded to their full form (e.g. /review). Slash commands queued via Ctrl+F are now properly processed through the slash command handler after the agent finishes, instead of being sent as raw text to the LLM. ([#13345](https://github.com/mastra-ai/mastra/pull/13345))

- Reduced tool result token limits to prevent oversized responses. Lowered file view and grep token limits from 3,000 to 2,000 tokens. Added 2,000 token truncation to web search and web extract tools, which previously returned unbounded results. ([#13348](https://github.com/mastra-ai/mastra/pull/13348))

- Fixed thread resuming in git worktrees. Previously, starting mastracode in a new worktree would resume a thread from another worktree of the same repo. Threads are now auto-tagged with the project path and filtered on resume so each worktree gets its own thread scope. ([#13343](https://github.com/mastra-ai/mastra/pull/13343))

- Updated dependencies [[`5c70aeb`](https://github.com/mastra-ai/mastra/commit/5c70aeb391434c34f9e43caa2e8572d412bcb2b0), [`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`5caa13d`](https://github.com/mastra-ai/mastra/commit/5caa13d1b2a496e2565ab124a11de9a51ad3e3b9), [`270dd16`](https://github.com/mastra-ai/mastra/commit/270dd168a86698a699d8a9de8dbce1a40f72d862), [`940163f`](https://github.com/mastra-ai/mastra/commit/940163fc492401d7562301e6f106ccef4fefe06f), [`5c70aeb`](https://github.com/mastra-ai/mastra/commit/5c70aeb391434c34f9e43caa2e8572d412bcb2b0), [`b260123`](https://github.com/mastra-ai/mastra/commit/b2601234bd093d358c92081a58f9b0befdae52b3), [`47892c8`](https://github.com/mastra-ai/mastra/commit/47892c85708eac348209f99f10f9a5f5267e11c0), [`45bb78b`](https://github.com/mastra-ai/mastra/commit/45bb78b70bd9db29678fe49476cd9f4ed01bfd0b), [`5c70aeb`](https://github.com/mastra-ai/mastra/commit/5c70aeb391434c34f9e43caa2e8572d412bcb2b0), [`70eef84`](https://github.com/mastra-ai/mastra/commit/70eef84b8f44493598fdafa2980a0e7283415eda), [`d84e52d`](https://github.com/mastra-ai/mastra/commit/d84e52d0f6511283ddd21ed5fe7f945449d0f799), [`24b80af`](https://github.com/mastra-ai/mastra/commit/24b80af87da93bb84d389340181e17b7477fa9ca), [`608e156`](https://github.com/mastra-ai/mastra/commit/608e156def954c9604c5e3f6d9dfce3bcc7aeab0), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`2b2e157`](https://github.com/mastra-ai/mastra/commit/2b2e157a092cd597d9d3f0000d62b8bb4a7348ed), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`59d30b5`](https://github.com/mastra-ai/mastra/commit/59d30b5d0cb44ea7a1c440e7460dfb57eac9a9b5), [`453693b`](https://github.com/mastra-ai/mastra/commit/453693bf9e265ddccecef901d50da6caaea0fbc6), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`c204b63`](https://github.com/mastra-ai/mastra/commit/c204b632d19e66acb6d6e19b11c4540dd6ad5380), [`742a417`](https://github.com/mastra-ai/mastra/commit/742a417896088220a3b5560c354c45c5ca6d88b9)]:
  - @mastra/libsql@1.6.0
  - @mastra/core@1.6.0
  - @mastra/memory@1.5.0

## 0.2.0-alpha.0

### Minor Changes

- Added streaming tool argument previews across all tool renderers. Tool names, file paths, and commands now appear immediately as the model generates them, rather than waiting for the complete tool call. ([#13328](https://github.com/mastra-ai/mastra/pull/13328))
  - **Generic tools** show live key/value argument previews as args stream in
  - **Edit tool** renders a bordered diff preview as soon as `old_str` and `new_str` are available, even before the tool result arrives
  - **Write tool** streams syntax-highlighted file content in a bordered box while args arrive
  - **Find files** shows the glob pattern in the pending header
  - **Task write** streams items directly into the pinned task list component in real-time

  All tools use partial JSON parsing to progressively display argument information. This is enabled automatically for all Harness-based agents — no configuration required.

### Patch Changes

- Improved subagent usage guidance: subagents are now only recommended when spawning multiple in parallel, and the main agent must verify all subagent output before proceeding. ([#13339](https://github.com/mastra-ai/mastra/pull/13339))

- Updated TUI to work with the new Harness object-parameter API, ensuring all commands, approvals, and thread flows continue to function correctly. ([#13353](https://github.com/mastra-ai/mastra/pull/13353))

- Added audit-tests subagent that reviews test quality in a branch. The parent agent passes a description of the branch work along with changed files to this read-only subagent, which explores existing test conventions then audits for behavioral coverage, intent-vs-test alignment, LLM-generated test slop, redundant assertions, file organization, and missing edge cases. ([#13331](https://github.com/mastra-ai/mastra/pull/13331))

- Fixed the `/mcp` slash command always showing "MCP system not initialized" even when MCP servers were configured and working. Server status and `/mcp reload` now work as expected. ([#13311](https://github.com/mastra-ai/mastra/pull/13311))

- Improved Observational Memory activation timing by halving the buffer interval when approaching the activation threshold, producing finer-grained chunks for more precise context management. ([#13357](https://github.com/mastra-ai/mastra/pull/13357))

- Fixed stale OAuth credentials when resolving the OpenAI Codex model. Auth storage is now reloaded before each model resolution, preventing authentication failures after token refresh. ([#13307](https://github.com/mastra-ai/mastra/pull/13307))

- Improved TUI composability for external consumers by exposing a structured `TUIState` interface and `createTUIState` factory. ([#13350](https://github.com/mastra-ai/mastra/pull/13350))

- Added AGENTS.md to the instruction file loader so projects created by create-mastra are automatically picked up. Removed support for the deprecated AGENT.md (singular) convention. ([#13346](https://github.com/mastra-ai/mastra/pull/13346))

- Fixed an issue where memory activation could shrink the message window too aggressively due to a token counting inaccuracy, resulting in very small context windows (~300 tokens). Temporarily raised the buffer activation threshold to prevent this. ([#13349](https://github.com/mastra-ai/mastra/pull/13349))

- Fixed assistant message text disappearing when todo_write tool calls were made during streaming ([#13335](https://github.com/mastra-ai/mastra/pull/13335))

- Fixed the view tool to gracefully handle view_range when viewing directories. Previously, passing view_range with a directory path would throw an error, and passing undefined values would fail schema validation. Now, view_range slices the directory listing to show a subset of entries, enabling pagination through large directories. ([#13355](https://github.com/mastra-ai/mastra/pull/13355))

- Updated README with current installation instructions for npm, pnpm, and Homebrew. ([#13294](https://github.com/mastra-ai/mastra/pull/13294))

- Simplified the MCP management API by replacing the `MCPManager` class with a `createMcpManager()` factory function. All existing behavior (TUI `/mcp` command, tool collection, config merging) is preserved. ([#13347](https://github.com/mastra-ai/mastra/pull/13347))

- **@mastra/core:** Added optional `threadLock` callbacks to `HarnessConfig` for preventing concurrent thread access across processes. The Harness calls `acquire`/`release` during `selectOrCreateThread`, `createThread`, and `switchThread` when configured. Locking is opt-in — when `threadLock` is not provided, behavior is unchanged. ([#13334](https://github.com/mastra-ai/mastra/pull/13334))

  ```ts
  const harness = new Harness({
    id: 'my-harness',
    storage: myStore,
    modes: [{ id: 'default', agent: myAgent }],
    threadLock: {
      acquire: threadId => acquireThreadLock(threadId),
      release: threadId => releaseThreadLock(threadId),
    },
  });
  ```

  **mastracode:** Wires the existing filesystem-based thread lock (`thread-lock.ts`) into the new `threadLock` config, restoring the concurrent access protection that was lost during the monorepo migration.

- Migrated from todo_write/todo_check tools to the new built-in task_write/task_check tools from @mastra/core/harness. Renamed all todo terminology to task across prompts, TUI components, and agent configurations. ([#13344](https://github.com/mastra-ai/mastra/pull/13344))

- Fixed Observational Memory status not updating during conversations. The harness was missing streaming handlers for OM data chunks (status, observation start/end, buffering, activation), so the TUI never received real-time OM progress updates. Also added switchObserverModel and switchReflectorModel methods so changing OM models properly emits events to subscribers. ([#13330](https://github.com/mastra-ai/mastra/pull/13330))

- Fixed Ctrl+F follow-up queueing to resolve autocomplete suggestions before reading editor text, so partially typed slash commands (e.g. /rev) are expanded to their full form (e.g. /review). Slash commands queued via Ctrl+F are now properly processed through the slash command handler after the agent finishes, instead of being sent as raw text to the LLM. ([#13345](https://github.com/mastra-ai/mastra/pull/13345))

- Reduced tool result token limits to prevent oversized responses. Lowered file view and grep token limits from 3,000 to 2,000 tokens. Added 2,000 token truncation to web search and web extract tools, which previously returned unbounded results. ([#13348](https://github.com/mastra-ai/mastra/pull/13348))

- Fixed thread resuming in git worktrees. Previously, starting mastracode in a new worktree would resume a thread from another worktree of the same repo. Threads are now auto-tagged with the project path and filtered on resume so each worktree gets its own thread scope. ([#13343](https://github.com/mastra-ai/mastra/pull/13343))

- Updated dependencies [[`5c70aeb`](https://github.com/mastra-ai/mastra/commit/5c70aeb391434c34f9e43caa2e8572d412bcb2b0), [`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`5caa13d`](https://github.com/mastra-ai/mastra/commit/5caa13d1b2a496e2565ab124a11de9a51ad3e3b9), [`270dd16`](https://github.com/mastra-ai/mastra/commit/270dd168a86698a699d8a9de8dbce1a40f72d862), [`940163f`](https://github.com/mastra-ai/mastra/commit/940163fc492401d7562301e6f106ccef4fefe06f), [`5c70aeb`](https://github.com/mastra-ai/mastra/commit/5c70aeb391434c34f9e43caa2e8572d412bcb2b0), [`b260123`](https://github.com/mastra-ai/mastra/commit/b2601234bd093d358c92081a58f9b0befdae52b3), [`47892c8`](https://github.com/mastra-ai/mastra/commit/47892c85708eac348209f99f10f9a5f5267e11c0), [`45bb78b`](https://github.com/mastra-ai/mastra/commit/45bb78b70bd9db29678fe49476cd9f4ed01bfd0b), [`5c70aeb`](https://github.com/mastra-ai/mastra/commit/5c70aeb391434c34f9e43caa2e8572d412bcb2b0), [`70eef84`](https://github.com/mastra-ai/mastra/commit/70eef84b8f44493598fdafa2980a0e7283415eda), [`d84e52d`](https://github.com/mastra-ai/mastra/commit/d84e52d0f6511283ddd21ed5fe7f945449d0f799), [`24b80af`](https://github.com/mastra-ai/mastra/commit/24b80af87da93bb84d389340181e17b7477fa9ca), [`608e156`](https://github.com/mastra-ai/mastra/commit/608e156def954c9604c5e3f6d9dfce3bcc7aeab0), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`2b2e157`](https://github.com/mastra-ai/mastra/commit/2b2e157a092cd597d9d3f0000d62b8bb4a7348ed), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`59d30b5`](https://github.com/mastra-ai/mastra/commit/59d30b5d0cb44ea7a1c440e7460dfb57eac9a9b5), [`453693b`](https://github.com/mastra-ai/mastra/commit/453693bf9e265ddccecef901d50da6caaea0fbc6), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`c204b63`](https://github.com/mastra-ai/mastra/commit/c204b632d19e66acb6d6e19b11c4540dd6ad5380), [`742a417`](https://github.com/mastra-ai/mastra/commit/742a417896088220a3b5560c354c45c5ca6d88b9)]:
  - @mastra/libsql@1.6.0-alpha.0
  - @mastra/core@1.6.0-alpha.0
  - @mastra/memory@1.5.0-alpha.0

## 0.1.0

### Minor Changes

- Added a separate export path for the TUI at `mastracode/tui`, so consumers can cleanly import MastraTUI and related components without reaching into internals. ([#13255](https://github.com/mastra-ai/mastra/pull/13255))

  ```ts
  import { MastraTUI, type MastraTUIOptions } from 'mastracode/tui';
  import { theme, setTheme, ModelSelectorComponent } from 'mastracode/tui';
  ```

- Migrated MastraCode from the prototype harness to the generic CoreHarness from @mastra/core. The createMastraCode function is now fully configurable with optional parameters for modes, subagents, storage, tools, and more. Removed the deprecated prototype harness implementation. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

### Patch Changes

- Added generic Harness class to @mastra/core for orchestrating agents with modes, state management, built-in tools (ask_user, submit_plan), subagent support, Observational Memory integration, model discovery, and permission-aware tool approval. The Harness provides a reusable foundation for building agent-powered applications with features like thread management, heartbeat monitoring, and event-driven architecture. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

- fix(schema-compat): fix zodToJsonSchema routing for v3/v4 Zod schemas ([#13253](https://github.com/mastra-ai/mastra/pull/13253))

  The `zodToJsonSchema` function now reliably detects and routes Zod v3 vs v4 schemas regardless of which version the ambient `zod` import resolves to. Previously, the detection relied on checking `'toJSONSchema' in z` against the ambient `z` import, which could resolve to either v3 or v4 depending on the environment (monorepo vs global install). This caused v3 schemas to be passed to v4's `toJSONSchema()` (crashing with "Cannot read properties of undefined (reading 'def')") or v4 schemas to be passed to the v3 converter (producing schemas missing the `type` field).

  The fix explicitly imports `z as zV4` from `zod/v4` and routes based on the schema's own `_zod` property, making the behavior environment-independent.

  Also migrates all mastracode tool files from `zod/v3` to `zod` imports now that the schema-compat fix supports both versions correctly.

- Fixed mastracode crashing on startup with ERR_MODULE_NOT_FOUND for vscode-jsonrpc/node. Node.js ESM requires explicit .js extensions on subpath imports. ([#13250](https://github.com/mastra-ai/mastra/pull/13250))

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`8650e4d`](https://github.com/mastra-ai/mastra/commit/8650e4d3579a2c3a13e2dba7ec6ee7c82c7f61a8), [`bd222d3`](https://github.com/mastra-ai/mastra/commit/bd222d39e292bfcc4a2d9a9e6ec3976cc5a4f22f), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0
  - @mastra/memory@1.4.0
  - @mastra/libsql@1.5.0

## 0.1.0-alpha.3

### Minor Changes

- Added a separate export path for the TUI at `mastracode/tui`, so consumers can cleanly import MastraTUI and related components without reaching into internals. ([#13255](https://github.com/mastra-ai/mastra/pull/13255))

  ```ts
  import { MastraTUI, type MastraTUIOptions } from 'mastracode/tui';
  import { theme, setTheme, ModelSelectorComponent } from 'mastracode/tui';
  ```

## 0.1.0-alpha.2

### Patch Changes

- fix(schema-compat): fix zodToJsonSchema routing for v3/v4 Zod schemas ([#13253](https://github.com/mastra-ai/mastra/pull/13253))

  The `zodToJsonSchema` function now reliably detects and routes Zod v3 vs v4 schemas regardless of which version the ambient `zod` import resolves to. Previously, the detection relied on checking `'toJSONSchema' in z` against the ambient `z` import, which could resolve to either v3 or v4 depending on the environment (monorepo vs global install). This caused v3 schemas to be passed to v4's `toJSONSchema()` (crashing with "Cannot read properties of undefined (reading 'def')") or v4 schemas to be passed to the v3 converter (producing schemas missing the `type` field).

  The fix explicitly imports `z as zV4` from `zod/v4` and routes based on the schema's own `_zod` property, making the behavior environment-independent.

  Also migrates all mastracode tool files from `zod/v3` to `zod` imports now that the schema-compat fix supports both versions correctly.

- Updated dependencies:
  - @mastra/core@1.5.0-alpha.1
  - @mastra/memory@1.4.0-alpha.1

## 0.1.0-alpha.1

### Patch Changes

- Fixed mastracode crashing on startup with ERR_MODULE_NOT_FOUND for vscode-jsonrpc/node. Node.js ESM requires explicit .js extensions on subpath imports. ([#13250](https://github.com/mastra-ai/mastra/pull/13250))

## 0.1.0-alpha.0

### Minor Changes

- Migrated MastraCode from the prototype harness to the generic CoreHarness from @mastra/core. The createMastraCode function is now fully configurable with optional parameters for modes, subagents, storage, tools, and more. Removed the deprecated prototype harness implementation. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

### Patch Changes

- Added generic Harness class to @mastra/core for orchestrating agents with modes, state management, built-in tools (ask_user, submit_plan), subagent support, Observational Memory integration, model discovery, and permission-aware tool approval. The Harness provides a reusable foundation for building agent-powered applications with features like thread management, heartbeat monitoring, and event-driven architecture. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`8650e4d`](https://github.com/mastra-ai/mastra/commit/8650e4d3579a2c3a13e2dba7ec6ee7c82c7f61a8), [`bd222d3`](https://github.com/mastra-ai/mastra/commit/bd222d39e292bfcc4a2d9a9e6ec3976cc5a4f22f), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0-alpha.0
  - @mastra/memory@1.4.0-alpha.0
  - @mastra/libsql@1.5.0-alpha.0
