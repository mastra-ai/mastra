# @mastra/code-sdk

## 1.5.0-alpha.6

### Patch Changes

- Updated dependencies [[`c8e4cea`](https://github.com/mastra-ai/mastra/commit/c8e4ceac9a390d78c8327dff3cdb2861dd71957f), [`ed01e9a`](https://github.com/mastra-ai/mastra/commit/ed01e9a807514a904374bf687a7b8f18750f6f78), [`a981e66`](https://github.com/mastra-ai/mastra/commit/a981e662ed8fc476292375d135cb14a2681efedf), [`ae2dc20`](https://github.com/mastra-ai/mastra/commit/ae2dc201dbb48466c3cf77e3d4ef04826132b2db), [`4e9a228`](https://github.com/mastra-ai/mastra/commit/4e9a2283d5fd6ed1b70a2751eb3dc2cbf82ada20), [`997cf5b`](https://github.com/mastra-ai/mastra/commit/997cf5bb3fc600b30aa20e048b663e48e0e1305a), [`63041eb`](https://github.com/mastra-ai/mastra/commit/63041eb4c50b520a0a80e03d4cd6ea99f67715a0)]:
  - @mastra/core@1.62.0-alpha.6
  - @mastra/pg@1.22.0-alpha.3
  - @mastra/mcp@1.17.2-alpha.1

## 1.5.0-alpha.5

### Patch Changes

- Add a `/context` command (alias `/ctx`) to Mastra Code that reports what is occupying the context window. ([#22131](https://github.com/mastra-ai/mastra/pull/22131))

  The report separates the startup context — system prompt, AGENTS.md/CLAUDE.md instructions with their source paths, the skills catalog, and MCP tool definitions rolled up per server — from context that accumulates during the session, namely the conversation itself and any observation memory injected into it. Each line carries an estimated token count and its share of the audited total, so it is possible to see which server, instruction file, or skill set is worth pruning.

  The audit reports only sizes and labels, never the audited content, and is printed to the terminal without being added to the conversation, so running it does not enlarge the context it describes.

  To support exact measurement, `@mastra/core` now exports `formatSkillsCatalog`, the pure formatter behind the skills processor's `<available_skills>` block, and `@mastra/code-sdk` exposes the assembled system prompt as labeled sections.

- Updated dependencies [[`65edab1`](https://github.com/mastra-ai/mastra/commit/65edab1c233d17b8f163bad12fca410d0e6f16b1), [`ab20a38`](https://github.com/mastra-ai/mastra/commit/ab20a38d0275f8d85e0f3833bd87ef487bcc609f), [`dbbfeb8`](https://github.com/mastra-ai/mastra/commit/dbbfeb85ec949dc9ebc0755e1ad262e4f5eba8db), [`3cc9d00`](https://github.com/mastra-ai/mastra/commit/3cc9d00b2b4333e0377a5e9df5eff92c17ce7630), [`733a537`](https://github.com/mastra-ai/mastra/commit/733a537489a858b5880b2e98809334fba895a221), [`d55807c`](https://github.com/mastra-ai/mastra/commit/d55807cb9f080f3f5d1db06aca02b8fe0992507e), [`9207dfa`](https://github.com/mastra-ai/mastra/commit/9207dfab8062e5fc68b751684797ff86fe0b4e70), [`12c61d2`](https://github.com/mastra-ai/mastra/commit/12c61d280c8cb208bc3c8dbcbe5dcc60cf9d1cd0), [`9a12ef3`](https://github.com/mastra-ai/mastra/commit/9a12ef3fccf3f4186db0f294f4ee1f02cf4d8db2)]:
  - @mastra/core@1.62.0-alpha.5
  - @mastra/memory@1.28.0-alpha.1

## 1.5.0-alpha.4

### Patch Changes

- Updated dependencies [[`79f04a7`](https://github.com/mastra-ai/mastra/commit/79f04a7f6c6829da541139f638f2f1d267916e08), [`fd4d5fe`](https://github.com/mastra-ai/mastra/commit/fd4d5fe4f943699b85db5e74404f190d5a6b8c2a), [`f9172b3`](https://github.com/mastra-ai/mastra/commit/f9172b35de085f9101348eeb60d7d4712505ed8f), [`f591643`](https://github.com/mastra-ai/mastra/commit/f591643becdf0be9bddce6ba1748e64bc30d77f1), [`b1ad324`](https://github.com/mastra-ai/mastra/commit/b1ad324d657f3544b0701332aef7eb10e9a36258), [`61c566d`](https://github.com/mastra-ai/mastra/commit/61c566dd2f2cde2b23ed8f139924e530d4202214)]:
  - @mastra/core@1.62.0-alpha.4
  - @mastra/pg@1.22.0-alpha.2

## 1.5.0-alpha.3

### Minor Changes

- Made language-server (LSP) support opt-in in Mastra Code. By default Mastra Code no longer checks for LSP dependencies, starts language servers, or offers the lsp_inspect tool to the agent. Turn it on by adding "lsp": true (or an LSP config object) to your settings.json; "lsp": false is now also accepted and preserved. ([#22126](https://github.com/mastra-ai/mastra/pull/22126))

### Patch Changes

- Workspace no longer registers the lsp_inspect tool when LSP is not active, so agents are only offered the tool when it can actually run. ([#22126](https://github.com/mastra-ai/mastra/pull/22126))

- Updated dependencies [[`c5eaec5`](https://github.com/mastra-ai/mastra/commit/c5eaec5a860d80d0e3805e67db0414b87ac8cbed), [`2c85f42`](https://github.com/mastra-ai/mastra/commit/2c85f428e04ccd63ea31a7ec80b5b327afdad555), [`11bbeb9`](https://github.com/mastra-ai/mastra/commit/11bbeb9b108ef2264e05acefc6dafb9cbb342921), [`1a485f3`](https://github.com/mastra-ai/mastra/commit/1a485f3538f5ec64d58bd8b5e1e99de0c695c87b), [`0d37487`](https://github.com/mastra-ai/mastra/commit/0d37487d9f349388a3f1cef6a536cf9dcc4b6273), [`8661d7d`](https://github.com/mastra-ai/mastra/commit/8661d7d7179f0a024456aabdd8679bcecd09ac28), [`575e343`](https://github.com/mastra-ai/mastra/commit/575e343900451021d96110916497d334af7bc252), [`8661d7d`](https://github.com/mastra-ai/mastra/commit/8661d7d7179f0a024456aabdd8679bcecd09ac28), [`cacb839`](https://github.com/mastra-ai/mastra/commit/cacb8392d9e74189b56d857290b0615f98a2683d), [`b47b26e`](https://github.com/mastra-ai/mastra/commit/b47b26e6fe95cb8a3482be2c5e52de157fe59d0b), [`0d37487`](https://github.com/mastra-ai/mastra/commit/0d37487d9f349388a3f1cef6a536cf9dcc4b6273), [`8661d7d`](https://github.com/mastra-ai/mastra/commit/8661d7d7179f0a024456aabdd8679bcecd09ac28), [`13c2f97`](https://github.com/mastra-ai/mastra/commit/13c2f979a63ee441834ad0d947b40a82010afb59), [`9a3d352`](https://github.com/mastra-ai/mastra/commit/9a3d352a5ba0c2a9e4f7a9cc4f028a393bc74306), [`c46eb09`](https://github.com/mastra-ai/mastra/commit/c46eb09ce4987509af57a0ac582c61241a6dd2f1), [`30ed33e`](https://github.com/mastra-ai/mastra/commit/30ed33ee14084a26019aba15fceadda6d6ddefaf), [`91ad69d`](https://github.com/mastra-ai/mastra/commit/91ad69d64994c89199b0c55399e64ed91c61df2f), [`c4e2364`](https://github.com/mastra-ai/mastra/commit/c4e2364742bc37beebfa995db2d42efce6cfc7b8), [`8dc408d`](https://github.com/mastra-ai/mastra/commit/8dc408d34438f9e13297f792c11a5cfd6cf952e1), [`c92def1`](https://github.com/mastra-ai/mastra/commit/c92def10a13c822972c96f0a4ca6ffc1f4258aed), [`c5eaec5`](https://github.com/mastra-ai/mastra/commit/c5eaec5a860d80d0e3805e67db0414b87ac8cbed), [`e66b2ba`](https://github.com/mastra-ai/mastra/commit/e66b2ba100db63eaeab6e21e1ea34b113f2ec781)]:
  - @mastra/pg@1.22.0-alpha.1
  - @mastra/libsql@1.22.0-alpha.0
  - @mastra/core@1.62.0-alpha.3
  - @mastra/observability@1.17.2-alpha.1
  - @mastra/memory@1.27.1-alpha.0
  - @mastra/mcp@1.17.2-alpha.0

## 1.4.1-alpha.2

### Patch Changes

- Updated dependencies [[`e737014`](https://github.com/mastra-ai/mastra/commit/e737014e0fc7035759762bb5b48baef1d6c0f6a7), [`e737014`](https://github.com/mastra-ai/mastra/commit/e737014e0fc7035759762bb5b48baef1d6c0f6a7), [`e737014`](https://github.com/mastra-ai/mastra/commit/e737014e0fc7035759762bb5b48baef1d6c0f6a7), [`d6ce34a`](https://github.com/mastra-ai/mastra/commit/d6ce34aeceb06ddf3d595a1eed5cc74f481a46a1), [`e6f8450`](https://github.com/mastra-ai/mastra/commit/e6f845074d478527026b18d85031b23353e1d0a4)]:
  - @mastra/duckdb@1.6.3-alpha.0
  - @mastra/core@1.62.0-alpha.2
  - @mastra/pg@1.22.0-alpha.0

## 1.4.1-alpha.1

### Patch Changes

- Updated dependencies [[`f95f468`](https://github.com/mastra-ai/mastra/commit/f95f468cf1e7c2b924a13826494f98b8f2ccd581), [`cb0291c`](https://github.com/mastra-ai/mastra/commit/cb0291cca0f8a769495375ff213cbda2512bb542)]:
  - @mastra/core@1.61.1-alpha.1
  - @mastra/observability@1.17.2-alpha.0
  - @mastra/mcp@1.17.1

## 1.4.1-alpha.0

### Patch Changes

- Updated dependencies [[`1e47b75`](https://github.com/mastra-ai/mastra/commit/1e47b7520cab4cfaa8daed52f17e2e6d14ff7539)]:
  - @mastra/core@1.61.1-alpha.0

## 1.4.0

### Minor Changes

- Fixed credential failures that told every interface to run `/login`, a command only the terminal UI has. A provider fetch without a usable credential now throws `ProviderAuthRequiredError`, which states the fact and leaves the remedy to the host running the agent. ([#21860](https://github.com/mastra-ai/mastra/pull/21860))

  ```ts
  import { ProviderAuthRequiredError } from '@mastra/code-sdk/auth/provider-auth-error';

  try {
    await run();
  } catch (error) {
    // Before: the message hardcoded "Run /login first."
    // Now: match the error and point the user at whatever sign-in path your host offers.
    if (error instanceof ProviderAuthRequiredError) showSignIn();
  }
  ```

  The error name is stable across serialization, so a client that only receives `{ name, message }` over the wire can match it too.

- Added opt-in process memory diagnostics for SDK process adapters. The service records process and V8 heap-space samples, naturally occurring garbage collection events, and periodic allocation profiles without forcing garbage collection or writing heap snapshots. ([#21821](https://github.com/mastra-ai/mastra/pull/21821))

  Start diagnostics before creating Mastra Code, then await the final capture after work-producing services stop:

  ```ts
  import {
    createProcessMemoryDiagnosticsFromEnvironment,
    startConfiguredProcessMemoryDiagnostics,
  } from '@mastra/code-sdk/process-memory-diagnostics';

  const setup = createProcessMemoryDiagnosticsFromEnvironment(process.env);
  const diagnostics = await startConfiguredProcessMemoryDiagnostics(setup, console.warn);

  try {
    // Create and run the process adapter.
  } finally {
    await diagnostics.stop();
  }
  ```

  Allocation profiles remain local and may contain prompts, credentials, file contents, and tool arguments. Keep them private and delete them after analysis.

### Patch Changes

- Factory runs now resolve provider credentials with org > user precedence, so an org-wide "Everyone in org" key takes priority over a run's acting user's personal key. This means factory automation always bills against the org's shared credentials when they exist, regardless of who triggered the run. Interactive (non-factory) sessions keep the existing user > org precedence, so personal plan subscriptions and keys still take priority there. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Interactive messages and model switches on factory sessions now resolve provider credentials org-first (org > user), matching board-run kickoff. The credential resolver keys off the session's `factoryProjectId` in controller state, so any run on a factory-owned session rides the org's shared keys with the caller's personal credentials as fallback — switching to a personal-only model still works through that fallback. Repo-backed Slack channel sessions now stamp the owning factory project onto session state so they get the same behavior. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Fixed shared threads running with a stale model in multi-server deployments. The model selected for a mode is now re-read from the thread's persisted settings at the start of every run, so a model switch made in one browser session or server replica is picked up by all others instead of silently diverging until the next mode switch. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Updated dependencies [[`88d14ca`](https://github.com/mastra-ai/mastra/commit/88d14cac008582a618fecc3d5c7fd3bdf4f6ddc3), [`480e491`](https://github.com/mastra-ai/mastra/commit/480e491588bd6a7a1c9ee4407590ad625dd33952), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`acc3471`](https://github.com/mastra-ai/mastra/commit/acc3471de5f3fde8027ee4e355af292b2bc1bc30), [`b6a771e`](https://github.com/mastra-ai/mastra/commit/b6a771ef23d203ddb348efca8065eff65def8191), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`3bb88dd`](https://github.com/mastra-ai/mastra/commit/3bb88ddf07fb98f3cd16d3bff94e51cd3b45d011), [`d23e75d`](https://github.com/mastra-ai/mastra/commit/d23e75d57cc7cf5b9bfdbee896bf5a6a2484fed7), [`c8faa4e`](https://github.com/mastra-ai/mastra/commit/c8faa4e1cfebaec56b65e754e90b9fe46d153359), [`acc3471`](https://github.com/mastra-ai/mastra/commit/acc3471de5f3fde8027ee4e355af292b2bc1bc30), [`d378d75`](https://github.com/mastra-ai/mastra/commit/d378d7511f71309ed61a8f6b93cd0361dc6cb70f), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`64cd7ac`](https://github.com/mastra-ai/mastra/commit/64cd7ac22c2c7a6e6b533a4b3a9ede432700f1fb), [`26d4016`](https://github.com/mastra-ai/mastra/commit/26d40160ff7f7d8bf95fee2039a52cbc83863533), [`7c60df5`](https://github.com/mastra-ai/mastra/commit/7c60df5c7872343fbac5c3e5b1175c8076a5abfd), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`f2031a4`](https://github.com/mastra-ai/mastra/commit/f2031a47445e8f67a89ba1309036816f97ab7a65), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`cad4208`](https://github.com/mastra-ai/mastra/commit/cad42082e6aa1776168a94914f523334be45d929), [`8e529d4`](https://github.com/mastra-ai/mastra/commit/8e529d4ac754efef04b225841349e0da9edf89a6), [`57c5103`](https://github.com/mastra-ai/mastra/commit/57c51035a2a36e3df3c4f32f46bb789a66ed5946), [`acc3471`](https://github.com/mastra-ai/mastra/commit/acc3471de5f3fde8027ee4e355af292b2bc1bc30), [`038b7b4`](https://github.com/mastra-ai/mastra/commit/038b7b405cb4ac25ab3f3031334111b1f87ac112), [`4132d61`](https://github.com/mastra-ai/mastra/commit/4132d61f8367077120ee9e6420d3224dffd93c93), [`1d41dd0`](https://github.com/mastra-ai/mastra/commit/1d41dd06a001c6fee3aab1cdf1ec759f2070df3e), [`d378d75`](https://github.com/mastra-ai/mastra/commit/d378d7511f71309ed61a8f6b93cd0361dc6cb70f)]:
  - @mastra/core@1.61.0
  - @mastra/libsql@1.21.1
  - @mastra/pg@1.21.1
  - @mastra/mcp@1.17.1

## 1.4.0-alpha.5

### Patch Changes

- Updated dependencies [[`7c60df5`](https://github.com/mastra-ai/mastra/commit/7c60df5c7872343fbac5c3e5b1175c8076a5abfd)]:
  - @mastra/core@1.61.0-alpha.5

## 1.4.0-alpha.4

### Patch Changes

- Updated dependencies [[`1d41dd0`](https://github.com/mastra-ai/mastra/commit/1d41dd06a001c6fee3aab1cdf1ec759f2070df3e)]:
  - @mastra/mcp@1.17.1-alpha.1
  - @mastra/core@1.61.0-alpha.4

## 1.4.0-alpha.3

### Patch Changes

- Factory runs now resolve provider credentials with org > user precedence, so an org-wide "Everyone in org" key takes priority over a run's acting user's personal key. This means factory automation always bills against the org's shared credentials when they exist, regardless of who triggered the run. Interactive (non-factory) sessions keep the existing user > org precedence, so personal plan subscriptions and keys still take priority there. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Interactive messages and model switches on factory sessions now resolve provider credentials org-first (org > user), matching board-run kickoff. The credential resolver keys off the session's `factoryProjectId` in controller state, so any run on a factory-owned session rides the org's shared keys with the caller's personal credentials as fallback — switching to a personal-only model still works through that fallback. Repo-backed Slack channel sessions now stamp the owning factory project onto session state so they get the same behavior. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Fixed shared threads running with a stale model in multi-server deployments. The model selected for a mode is now re-read from the thread's persisted settings at the start of every run, so a model switch made in one browser session or server replica is picked up by all others instead of silently diverging until the next mode switch. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Updated dependencies [[`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`acc3471`](https://github.com/mastra-ai/mastra/commit/acc3471de5f3fde8027ee4e355af292b2bc1bc30), [`b6a771e`](https://github.com/mastra-ai/mastra/commit/b6a771ef23d203ddb348efca8065eff65def8191), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`acc3471`](https://github.com/mastra-ai/mastra/commit/acc3471de5f3fde8027ee4e355af292b2bc1bc30), [`26d4016`](https://github.com/mastra-ai/mastra/commit/26d40160ff7f7d8bf95fee2039a52cbc83863533), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`57c5103`](https://github.com/mastra-ai/mastra/commit/57c51035a2a36e3df3c4f32f46bb789a66ed5946), [`acc3471`](https://github.com/mastra-ai/mastra/commit/acc3471de5f3fde8027ee4e355af292b2bc1bc30)]:
  - @mastra/core@1.61.0-alpha.3
  - @mastra/libsql@1.21.1-alpha.1
  - @mastra/pg@1.21.1-alpha.1

## 1.4.0-alpha.2

### Patch Changes

- Updated dependencies [[`480e491`](https://github.com/mastra-ai/mastra/commit/480e491588bd6a7a1c9ee4407590ad625dd33952), [`3bb88dd`](https://github.com/mastra-ai/mastra/commit/3bb88ddf07fb98f3cd16d3bff94e51cd3b45d011), [`d378d75`](https://github.com/mastra-ai/mastra/commit/d378d7511f71309ed61a8f6b93cd0361dc6cb70f), [`cad4208`](https://github.com/mastra-ai/mastra/commit/cad42082e6aa1776168a94914f523334be45d929), [`d378d75`](https://github.com/mastra-ai/mastra/commit/d378d7511f71309ed61a8f6b93cd0361dc6cb70f)]:
  - @mastra/core@1.61.0-alpha.2

## 1.4.0-alpha.1

### Minor Changes

- Fixed credential failures that told every interface to run `/login`, a command only the terminal UI has. A provider fetch without a usable credential now throws `ProviderAuthRequiredError`, which states the fact and leaves the remedy to the host running the agent. ([#21860](https://github.com/mastra-ai/mastra/pull/21860))

  ```ts
  import { ProviderAuthRequiredError } from '@mastra/code-sdk/auth/provider-auth-error';

  try {
    await run();
  } catch (error) {
    // Before: the message hardcoded "Run /login first."
    // Now: match the error and point the user at whatever sign-in path your host offers.
    if (error instanceof ProviderAuthRequiredError) showSignIn();
  }
  ```

  The error name is stable across serialization, so a client that only receives `{ name, message }` over the wire can match it too.

- Added opt-in process memory diagnostics for SDK process adapters. The service records process and V8 heap-space samples, naturally occurring garbage collection events, and periodic allocation profiles without forcing garbage collection or writing heap snapshots. ([#21821](https://github.com/mastra-ai/mastra/pull/21821))

  Start diagnostics before creating Mastra Code, then await the final capture after work-producing services stop:

  ```ts
  import {
    createProcessMemoryDiagnosticsFromEnvironment,
    startConfiguredProcessMemoryDiagnostics,
  } from '@mastra/code-sdk/process-memory-diagnostics';

  const setup = createProcessMemoryDiagnosticsFromEnvironment(process.env);
  const diagnostics = await startConfiguredProcessMemoryDiagnostics(setup, console.warn);

  try {
    // Create and run the process adapter.
  } finally {
    await diagnostics.stop();
  }
  ```

  Allocation profiles remain local and may contain prompts, credentials, file contents, and tool arguments. Keep them private and delete them after analysis.

### Patch Changes

- Updated dependencies [[`d23e75d`](https://github.com/mastra-ai/mastra/commit/d23e75d57cc7cf5b9bfdbee896bf5a6a2484fed7), [`c8faa4e`](https://github.com/mastra-ai/mastra/commit/c8faa4e1cfebaec56b65e754e90b9fe46d153359), [`f2031a4`](https://github.com/mastra-ai/mastra/commit/f2031a47445e8f67a89ba1309036816f97ab7a65), [`8e529d4`](https://github.com/mastra-ai/mastra/commit/8e529d4ac754efef04b225841349e0da9edf89a6)]:
  - @mastra/core@1.61.0-alpha.1

## 1.3.1-alpha.0

### Patch Changes

- Updated dependencies [[`88d14ca`](https://github.com/mastra-ai/mastra/commit/88d14cac008582a618fecc3d5c7fd3bdf4f6ddc3), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`64cd7ac`](https://github.com/mastra-ai/mastra/commit/64cd7ac22c2c7a6e6b533a4b3a9ede432700f1fb), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`038b7b4`](https://github.com/mastra-ai/mastra/commit/038b7b405cb4ac25ab3f3031334111b1f87ac112), [`4132d61`](https://github.com/mastra-ai/mastra/commit/4132d61f8367077120ee9e6420d3224dffd93c93)]:
  - @mastra/core@1.60.1-alpha.0
  - @mastra/libsql@1.21.1-alpha.0
  - @mastra/pg@1.21.1-alpha.0
  - @mastra/mcp@1.17.1-alpha.0

## 1.3.0

### Minor Changes

- Added foundational support for an upcoming experimental memory capability across storage, runtime, and developer tooling. ([#19538](https://github.com/mastra-ai/mastra/pull/19538))

- Added opt-in discovery for MCP servers configured globally in Claude Code and Codex CLI. Enable the sources with `mcp.claudeCodeGlobal` or `mcp.codexGlobal` in Mastra Code settings. ([#21598](https://github.com/mastra-ai/mastra/pull/21598))

### Patch Changes

- Fixed custom command discovery loading Markdown files from node_modules. ([#21680](https://github.com/mastra-ai/mastra/pull/21680))

- Stop an unread hook stdin from crashing the host process. A hook command that exits without reading its stdin closes the pipe mid-write, and the resulting EPIPE arrived as an unhandled socket error rather than a throw, so the surrounding `try/catch` never saw it and Node tore the process down. The socket error is now absorbed; the hook's real outcome still comes from its exit code. ([#21796](https://github.com/mastra-ai/mastra/pull/21796))

- Updated dependencies [[`587f6ef`](https://github.com/mastra-ai/mastra/commit/587f6efcfc25880b93760a8607d1cd381ec612fe), [`7e096f0`](https://github.com/mastra-ai/mastra/commit/7e096f02f0dddbf09b85d306458351245ed2f886), [`d7e6745`](https://github.com/mastra-ai/mastra/commit/d7e67456954863c55440ea9c49bc6ceb9949972d), [`6223446`](https://github.com/mastra-ai/mastra/commit/6223446ddce6166e96e0ba5e00d628b615dee8ca), [`15101bb`](https://github.com/mastra-ai/mastra/commit/15101bb53c0d934f31af6b8813b88191e382a5e5), [`4e7a421`](https://github.com/mastra-ai/mastra/commit/4e7a421dce8a48742f785d1e93ad2f43a572b282), [`c2c3deb`](https://github.com/mastra-ai/mastra/commit/c2c3debcf670c7082d0a5e553aa99818a864698c), [`4077487`](https://github.com/mastra-ai/mastra/commit/407748777c9bc9d5795033f36220e97df5553355), [`d8308a2`](https://github.com/mastra-ai/mastra/commit/d8308a2be3c07e777393d1017a381dcae3890d30), [`b0a2a07`](https://github.com/mastra-ai/mastra/commit/b0a2a07800d42bd9823292e7db832374ed084c9c), [`74e5bd3`](https://github.com/mastra-ai/mastra/commit/74e5bd315b8b3a1e04cb6cf480bb0f5fc4951dc8), [`242e324`](https://github.com/mastra-ai/mastra/commit/242e3241e73cbd5c9bb86a31ebb49ca0256488d4), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`d774e89`](https://github.com/mastra-ai/mastra/commit/d774e8930c781df8c9effe3763e6b501c099b6cc), [`9c27a53`](https://github.com/mastra-ai/mastra/commit/9c27a53cd9d3de4f3f025bc387d94ce371c33f95), [`8f0a332`](https://github.com/mastra-ai/mastra/commit/8f0a3321bf180368d76fe7b36aa1a8f60f00b6de), [`d6c618f`](https://github.com/mastra-ai/mastra/commit/d6c618f37496f801827d4caa76feab742f1a7383), [`0b4f108`](https://github.com/mastra-ai/mastra/commit/0b4f1089aa8d92e67c2a8e99726822c5ee410784), [`9acb50f`](https://github.com/mastra-ai/mastra/commit/9acb50f71cec9c362f06820033f90ae6b1f8282f), [`46e9e3f`](https://github.com/mastra-ai/mastra/commit/46e9e3f73babe1bc70080a596cf2ac0b9da48519), [`b0a2a07`](https://github.com/mastra-ai/mastra/commit/b0a2a07800d42bd9823292e7db832374ed084c9c), [`3f9a190`](https://github.com/mastra-ai/mastra/commit/3f9a19057c027155867b9317294ee4ca7bd0581a), [`dff25a1`](https://github.com/mastra-ai/mastra/commit/dff25a1103fa72ee082a9b6f805ebeb5ce400753), [`6db7a5d`](https://github.com/mastra-ai/mastra/commit/6db7a5dd3dd2b6f7ef75dcd804fcffef5fa83963), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`583e235`](https://github.com/mastra-ai/mastra/commit/583e23519c13af16c1746f9c49722d011216611b), [`b098de9`](https://github.com/mastra-ai/mastra/commit/b098de9d7cb9f672e0883a5c716465a3a689693d), [`e8808e3`](https://github.com/mastra-ai/mastra/commit/e8808e3d8eb585a2565be53e56a7e0e1477352a4), [`694bd68`](https://github.com/mastra-ai/mastra/commit/694bd68fb427ee52e59aaab06167617f261b121c), [`a77f8d4`](https://github.com/mastra-ai/mastra/commit/a77f8d4740d2178a74c41e4bf678b4fcd8fa0bb2), [`7f78585`](https://github.com/mastra-ai/mastra/commit/7f785857e401570e2ffb316911f126ed363aa537), [`33374ba`](https://github.com/mastra-ai/mastra/commit/33374ba359e4fb13eaa918ae925fe167a3c55414), [`940bf5c`](https://github.com/mastra-ai/mastra/commit/940bf5ccf04f2c9ebd8a1390431733222a03b1cd), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`58c43d3`](https://github.com/mastra-ai/mastra/commit/58c43d3f7cb2eeaeb8ac733ae71dde822348e588), [`ef6e295`](https://github.com/mastra-ai/mastra/commit/ef6e295b59bc25a5b61b633a89c97bcfce9fb465), [`208e1b3`](https://github.com/mastra-ai/mastra/commit/208e1b39f30f4b386e494394e9d71d96f0f90241), [`c938d34`](https://github.com/mastra-ai/mastra/commit/c938d34739936c8ecbabd67ad6a4a4396f41c4c6), [`88ddc7c`](https://github.com/mastra-ai/mastra/commit/88ddc7ce01d40175f13a3228b789a906779680bd), [`f2a4afd`](https://github.com/mastra-ai/mastra/commit/f2a4afd7e37e809669001ed17724b341a5c1f45e), [`f2a4afd`](https://github.com/mastra-ai/mastra/commit/f2a4afd7e37e809669001ed17724b341a5c1f45e), [`d438148`](https://github.com/mastra-ai/mastra/commit/d438148e222c1e2fb3c652725ce75680962ebec4), [`ba05fe0`](https://github.com/mastra-ai/mastra/commit/ba05fe0738f70cb686777546e968237d09269142), [`eede4de`](https://github.com/mastra-ai/mastra/commit/eede4de104f59b391d28aa249659388e9a1cf558), [`40d358e`](https://github.com/mastra-ai/mastra/commit/40d358e29d55543803e64b49241122f598ffabc7), [`d26a8d4`](https://github.com/mastra-ai/mastra/commit/d26a8d4281f28414715b333c85bedaf70d0b2890), [`e80cd7e`](https://github.com/mastra-ai/mastra/commit/e80cd7e7683e7d732e1cc6784bcac1d2640d2ce3), [`ccbbcd9`](https://github.com/mastra-ai/mastra/commit/ccbbcd974eedff4367a54ed0e24c9ee742ab2f61), [`39ba1b9`](https://github.com/mastra-ai/mastra/commit/39ba1b9ce256a9a910a16f125cc6a59588185bfe), [`1d9a0ea`](https://github.com/mastra-ai/mastra/commit/1d9a0ea4a9901baee6cd56737243bd6d1f631ac0), [`677cdc6`](https://github.com/mastra-ai/mastra/commit/677cdc6af564dec29a13464d12b7ab2a4efc22e9), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`a7dd322`](https://github.com/mastra-ai/mastra/commit/a7dd32247d95afc539f483ca37f4594af0387f59), [`3f5c6f7`](https://github.com/mastra-ai/mastra/commit/3f5c6f728ea35da344248de9aa070f12849f3aa0), [`eede4de`](https://github.com/mastra-ai/mastra/commit/eede4de104f59b391d28aa249659388e9a1cf558), [`a318490`](https://github.com/mastra-ai/mastra/commit/a318490e17da32f338d50929c770d901a9b3dd72), [`b860493`](https://github.com/mastra-ai/mastra/commit/b86049391100e665d579f700c8a2034c036defc3), [`0e5b1d9`](https://github.com/mastra-ai/mastra/commit/0e5b1d9513399e5ef6f1c114367393abf124a8e2), [`5c3e4d9`](https://github.com/mastra-ai/mastra/commit/5c3e4d9082b483e911c82baf1f3f4d4b27be5bc3), [`d4be8c1`](https://github.com/mastra-ai/mastra/commit/d4be8c1739d22d621e3f78790e1dd5eb5ecc3589), [`a5d2eb1`](https://github.com/mastra-ai/mastra/commit/a5d2eb10347eade1ae2816d88f466c25186c54a5), [`13d49d8`](https://github.com/mastra-ai/mastra/commit/13d49d82f434f319d4bd9a4234369d8186f8e102), [`0f53aeb`](https://github.com/mastra-ai/mastra/commit/0f53aeb119158bd9f83bd8ef667f1f675740e8f0), [`a97044b`](https://github.com/mastra-ai/mastra/commit/a97044b00cc79e189b07509701b2694c728dfeac), [`3667679`](https://github.com/mastra-ai/mastra/commit/3667679db057edfb086846d13369fdda4902ad65), [`49696e8`](https://github.com/mastra-ai/mastra/commit/49696e8e42f870674a0a58f5abcd22cc54dd2864), [`2ef2f23`](https://github.com/mastra-ai/mastra/commit/2ef2f230a7aed342e7dc3b2000cd42e4c43e08a7), [`4c0b961`](https://github.com/mastra-ai/mastra/commit/4c0b9611e89c5097b7a02a28c6816e0adcbcfa09), [`763e0c6`](https://github.com/mastra-ai/mastra/commit/763e0c61e04d76ad9a9efd301aa57525ca0cbea9), [`20504b2`](https://github.com/mastra-ai/mastra/commit/20504b2ecebd0e077acda3d457ab57480a98ed3e), [`0db29ce`](https://github.com/mastra-ai/mastra/commit/0db29ce28d0089e2e0a9a65270321ed08d5d9ce6), [`77e6b1b`](https://github.com/mastra-ai/mastra/commit/77e6b1bc4c46ce94fe501023fb4393c812ec6be3), [`c5f964d`](https://github.com/mastra-ai/mastra/commit/c5f964d3f77064e978f8066ec506eed77ba5c63c), [`23e0be2`](https://github.com/mastra-ai/mastra/commit/23e0be261381e49534b4ff3101c60ee64a946cbf), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`2d56f92`](https://github.com/mastra-ai/mastra/commit/2d56f922d4090fded13a68029d8eeed1a7857c79), [`7fc8806`](https://github.com/mastra-ai/mastra/commit/7fc880627d3cbf995d31ea0e8b807bf15417e651), [`0e02eac`](https://github.com/mastra-ai/mastra/commit/0e02eacdb2e30e1697a41910b41163742a181dc1), [`4df174c`](https://github.com/mastra-ai/mastra/commit/4df174c32bddf093a82f273070b8380aef7c9e90), [`f7c25b5`](https://github.com/mastra-ai/mastra/commit/f7c25b5106ddfb48e591f98df7a51e0f2dd01dba), [`7aad631`](https://github.com/mastra-ai/mastra/commit/7aad631b43bc10db77d5b8c66b200d7a49d18bf2), [`512100a`](https://github.com/mastra-ai/mastra/commit/512100a7d8b7e9c920f2590c6b3612f5de0d3cff), [`e81744c`](https://github.com/mastra-ai/mastra/commit/e81744cd13c46619c142dc521dc0baac47607a84), [`f8f653f`](https://github.com/mastra-ai/mastra/commit/f8f653f10980d01a73706cc3c8689ca5e40ce808), [`cd19e4c`](https://github.com/mastra-ai/mastra/commit/cd19e4c575e4129cd20e3d881acc75120bfcdde0), [`dc09cc1`](https://github.com/mastra-ai/mastra/commit/dc09cc1083d861cde192c1cd235324dc75b8c731), [`7f78585`](https://github.com/mastra-ai/mastra/commit/7f785857e401570e2ffb316911f126ed363aa537), [`e81744c`](https://github.com/mastra-ai/mastra/commit/e81744cd13c46619c142dc521dc0baac47607a84), [`9ef432b`](https://github.com/mastra-ai/mastra/commit/9ef432b6faa534b57b0d182a610e13dd9a7123ff), [`36b4649`](https://github.com/mastra-ai/mastra/commit/36b4649045a3a380cbab8ceca866db4086223aff), [`b9cf308`](https://github.com/mastra-ai/mastra/commit/b9cf30846f97f99ac1906ee8a68f4f2d117b0378), [`2e1d098`](https://github.com/mastra-ai/mastra/commit/2e1d0984e325fd319d32ea182f596b3170be3847), [`377eb81`](https://github.com/mastra-ai/mastra/commit/377eb81ce43b964e3a6b541df172da74a8ff3716), [`1794a79`](https://github.com/mastra-ai/mastra/commit/1794a79178c418004a7261b1ad9114066f7ef01d), [`0cdc5dc`](https://github.com/mastra-ai/mastra/commit/0cdc5dc69024957815da4f51acc4119eb4f447d7), [`5740ec6`](https://github.com/mastra-ai/mastra/commit/5740ec60c760ffdfbfaa59d603d03b847c864e05)]:
  - @mastra/core@1.60.0
  - @mastra/observability@1.17.1
  - @mastra/memory@1.27.0
  - @mastra/mcp@1.17.0
  - @mastra/pg@1.21.0
  - @mastra/libsql@1.21.0
  - @mastra/duckdb@1.6.2

## 1.3.0-alpha.14

### Patch Changes

- Updated dependencies [[`58c43d3`](https://github.com/mastra-ai/mastra/commit/58c43d3f7cb2eeaeb8ac733ae71dde822348e588)]:
  - @mastra/core@1.60.0-alpha.14

## 1.3.0-alpha.13

### Minor Changes

- Added foundational support for an upcoming experimental memory capability across storage, runtime, and developer tooling. ([#19538](https://github.com/mastra-ai/mastra/pull/19538))

### Patch Changes

- Stop an unread hook stdin from crashing the host process. A hook command that exits without reading its stdin closes the pipe mid-write, and the resulting EPIPE arrived as an unhandled socket error rather than a throw, so the surrounding `try/catch` never saw it and Node tore the process down. The socket error is now absorbed; the hook's real outcome still comes from its exit code. ([#21796](https://github.com/mastra-ai/mastra/pull/21796))

- Updated dependencies [[`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`2ef2f23`](https://github.com/mastra-ai/mastra/commit/2ef2f230a7aed342e7dc3b2000cd42e4c43e08a7), [`5740ec6`](https://github.com/mastra-ai/mastra/commit/5740ec60c760ffdfbfaa59d603d03b847c864e05)]:
  - @mastra/core@1.60.0-alpha.13
  - @mastra/memory@1.27.0-alpha.3
  - @mastra/libsql@1.21.0-alpha.1
  - @mastra/pg@1.21.0-alpha.4

## 1.3.0-alpha.12

### Patch Changes

- Updated dependencies [[`6db7a5d`](https://github.com/mastra-ai/mastra/commit/6db7a5dd3dd2b6f7ef75dcd804fcffef5fa83963), [`0e5b1d9`](https://github.com/mastra-ai/mastra/commit/0e5b1d9513399e5ef6f1c114367393abf124a8e2), [`0cdc5dc`](https://github.com/mastra-ai/mastra/commit/0cdc5dc69024957815da4f51acc4119eb4f447d7)]:
  - @mastra/core@1.60.0-alpha.12
  - @mastra/pg@1.20.1-alpha.3

## 1.3.0-alpha.11

### Patch Changes

- Updated dependencies [[`6223446`](https://github.com/mastra-ai/mastra/commit/6223446ddce6166e96e0ba5e00d628b615dee8ca), [`583e235`](https://github.com/mastra-ai/mastra/commit/583e23519c13af16c1746f9c49722d011216611b), [`a77f8d4`](https://github.com/mastra-ai/mastra/commit/a77f8d4740d2178a74c41e4bf678b4fcd8fa0bb2), [`40d358e`](https://github.com/mastra-ai/mastra/commit/40d358e29d55543803e64b49241122f598ffabc7), [`e80cd7e`](https://github.com/mastra-ai/mastra/commit/e80cd7e7683e7d732e1cc6784bcac1d2640d2ce3), [`39ba1b9`](https://github.com/mastra-ai/mastra/commit/39ba1b9ce256a9a910a16f125cc6a59588185bfe), [`0f53aeb`](https://github.com/mastra-ai/mastra/commit/0f53aeb119158bd9f83bd8ef667f1f675740e8f0), [`20504b2`](https://github.com/mastra-ai/mastra/commit/20504b2ecebd0e077acda3d457ab57480a98ed3e), [`0db29ce`](https://github.com/mastra-ai/mastra/commit/0db29ce28d0089e2e0a9a65270321ed08d5d9ce6)]:
  - @mastra/core@1.60.0-alpha.11
  - @mastra/mcp@1.17.0-alpha.2
  - @mastra/libsql@1.20.1-alpha.0
  - @mastra/pg@1.20.1-alpha.2

## 1.3.0-alpha.10

### Patch Changes

- Updated dependencies [[`b860493`](https://github.com/mastra-ai/mastra/commit/b86049391100e665d579f700c8a2034c036defc3)]:
  - @mastra/core@1.60.0-alpha.10

## 1.3.0-alpha.9

### Patch Changes

- Updated dependencies [[`b0a2a07`](https://github.com/mastra-ai/mastra/commit/b0a2a07800d42bd9823292e7db832374ed084c9c), [`b0a2a07`](https://github.com/mastra-ai/mastra/commit/b0a2a07800d42bd9823292e7db832374ed084c9c), [`ccbbcd9`](https://github.com/mastra-ai/mastra/commit/ccbbcd974eedff4367a54ed0e24c9ee742ab2f61), [`3f5c6f7`](https://github.com/mastra-ai/mastra/commit/3f5c6f728ea35da344248de9aa070f12849f3aa0), [`77e6b1b`](https://github.com/mastra-ai/mastra/commit/77e6b1bc4c46ce94fe501023fb4393c812ec6be3), [`2e1d098`](https://github.com/mastra-ai/mastra/commit/2e1d0984e325fd319d32ea182f596b3170be3847)]:
  - @mastra/memory@1.27.0-alpha.2
  - @mastra/core@1.60.0-alpha.9

## 1.3.0-alpha.8

### Minor Changes

- Added opt-in discovery for MCP servers configured globally in Claude Code and Codex CLI. Enable the sources with `mcp.claudeCodeGlobal` or `mcp.codexGlobal` in Mastra Code settings. ([#21598](https://github.com/mastra-ai/mastra/pull/21598))

### Patch Changes

- Fixed custom command discovery loading Markdown files from node_modules. ([#21680](https://github.com/mastra-ai/mastra/pull/21680))

- Updated dependencies [[`4e7a421`](https://github.com/mastra-ai/mastra/commit/4e7a421dce8a48742f785d1e93ad2f43a572b282), [`4077487`](https://github.com/mastra-ai/mastra/commit/407748777c9bc9d5795033f36220e97df5553355), [`242e324`](https://github.com/mastra-ai/mastra/commit/242e3241e73cbd5c9bb86a31ebb49ca0256488d4), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`d774e89`](https://github.com/mastra-ai/mastra/commit/d774e8930c781df8c9effe3763e6b501c099b6cc), [`9c27a53`](https://github.com/mastra-ai/mastra/commit/9c27a53cd9d3de4f3f025bc387d94ce371c33f95), [`dff25a1`](https://github.com/mastra-ai/mastra/commit/dff25a1103fa72ee082a9b6f805ebeb5ce400753), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`7f78585`](https://github.com/mastra-ai/mastra/commit/7f785857e401570e2ffb316911f126ed363aa537), [`f2a4afd`](https://github.com/mastra-ai/mastra/commit/f2a4afd7e37e809669001ed17724b341a5c1f45e), [`f2a4afd`](https://github.com/mastra-ai/mastra/commit/f2a4afd7e37e809669001ed17724b341a5c1f45e), [`d438148`](https://github.com/mastra-ai/mastra/commit/d438148e222c1e2fb3c652725ce75680962ebec4), [`ba05fe0`](https://github.com/mastra-ai/mastra/commit/ba05fe0738f70cb686777546e968237d09269142), [`d26a8d4`](https://github.com/mastra-ai/mastra/commit/d26a8d4281f28414715b333c85bedaf70d0b2890), [`677cdc6`](https://github.com/mastra-ai/mastra/commit/677cdc6af564dec29a13464d12b7ab2a4efc22e9), [`a318490`](https://github.com/mastra-ai/mastra/commit/a318490e17da32f338d50929c770d901a9b3dd72), [`763e0c6`](https://github.com/mastra-ai/mastra/commit/763e0c61e04d76ad9a9efd301aa57525ca0cbea9), [`23e0be2`](https://github.com/mastra-ai/mastra/commit/23e0be261381e49534b4ff3101c60ee64a946cbf), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`7fc8806`](https://github.com/mastra-ai/mastra/commit/7fc880627d3cbf995d31ea0e8b807bf15417e651), [`0e02eac`](https://github.com/mastra-ai/mastra/commit/0e02eacdb2e30e1697a41910b41163742a181dc1), [`4df174c`](https://github.com/mastra-ai/mastra/commit/4df174c32bddf093a82f273070b8380aef7c9e90), [`f7c25b5`](https://github.com/mastra-ai/mastra/commit/f7c25b5106ddfb48e591f98df7a51e0f2dd01dba), [`cd19e4c`](https://github.com/mastra-ai/mastra/commit/cd19e4c575e4129cd20e3d881acc75120bfcdde0), [`dc09cc1`](https://github.com/mastra-ai/mastra/commit/dc09cc1083d861cde192c1cd235324dc75b8c731), [`7f78585`](https://github.com/mastra-ai/mastra/commit/7f785857e401570e2ffb316911f126ed363aa537), [`36b4649`](https://github.com/mastra-ai/mastra/commit/36b4649045a3a380cbab8ceca866db4086223aff), [`377eb81`](https://github.com/mastra-ai/mastra/commit/377eb81ce43b964e3a6b541df172da74a8ff3716)]:
  - @mastra/core@1.60.0-alpha.8
  - @mastra/observability@1.17.1-alpha.2
  - @mastra/memory@1.27.0-alpha.1
  - @mastra/mcp@1.17.0-alpha.1
  - @mastra/pg@1.20.1-alpha.1

## 1.2.2-alpha.7

### Patch Changes

- Updated dependencies [[`940bf5c`](https://github.com/mastra-ai/mastra/commit/940bf5ccf04f2c9ebd8a1390431733222a03b1cd)]:
  - @mastra/core@1.60.0-alpha.7

## 1.2.2-alpha.6

### Patch Changes

- Updated dependencies [[`0b4f108`](https://github.com/mastra-ai/mastra/commit/0b4f1089aa8d92e67c2a8e99726822c5ee410784), [`88ddc7c`](https://github.com/mastra-ai/mastra/commit/88ddc7ce01d40175f13a3228b789a906779680bd), [`a7dd322`](https://github.com/mastra-ai/mastra/commit/a7dd32247d95afc539f483ca37f4594af0387f59)]:
  - @mastra/core@1.60.0-alpha.6

## 1.2.2-alpha.5

### Patch Changes

- Updated dependencies [[`74e5bd3`](https://github.com/mastra-ai/mastra/commit/74e5bd315b8b3a1e04cb6cf480bb0f5fc4951dc8)]:
  - @mastra/core@1.60.0-alpha.5

## 1.2.2-alpha.4

### Patch Changes

- Updated dependencies [[`d7e6745`](https://github.com/mastra-ai/mastra/commit/d7e67456954863c55440ea9c49bc6ceb9949972d), [`9acb50f`](https://github.com/mastra-ai/mastra/commit/9acb50f71cec9c362f06820033f90ae6b1f8282f), [`46e9e3f`](https://github.com/mastra-ai/mastra/commit/46e9e3f73babe1bc70080a596cf2ac0b9da48519), [`3f9a190`](https://github.com/mastra-ai/mastra/commit/3f9a19057c027155867b9317294ee4ca7bd0581a), [`e8808e3`](https://github.com/mastra-ai/mastra/commit/e8808e3d8eb585a2565be53e56a7e0e1477352a4), [`eede4de`](https://github.com/mastra-ai/mastra/commit/eede4de104f59b391d28aa249659388e9a1cf558), [`eede4de`](https://github.com/mastra-ai/mastra/commit/eede4de104f59b391d28aa249659388e9a1cf558), [`d4be8c1`](https://github.com/mastra-ai/mastra/commit/d4be8c1739d22d621e3f78790e1dd5eb5ecc3589), [`a5d2eb1`](https://github.com/mastra-ai/mastra/commit/a5d2eb10347eade1ae2816d88f466c25186c54a5), [`13d49d8`](https://github.com/mastra-ai/mastra/commit/13d49d82f434f319d4bd9a4234369d8186f8e102), [`a97044b`](https://github.com/mastra-ai/mastra/commit/a97044b00cc79e189b07509701b2694c728dfeac), [`e81744c`](https://github.com/mastra-ai/mastra/commit/e81744cd13c46619c142dc521dc0baac47607a84), [`e81744c`](https://github.com/mastra-ai/mastra/commit/e81744cd13c46619c142dc521dc0baac47607a84)]:
  - @mastra/core@1.60.0-alpha.4
  - @mastra/memory@1.27.0-alpha.0
  - @mastra/mcp@1.17.0-alpha.0
  - @mastra/observability@1.17.1-alpha.1

## 1.2.2-alpha.3

### Patch Changes

- Updated dependencies [[`d8308a2`](https://github.com/mastra-ai/mastra/commit/d8308a2be3c07e777393d1017a381dcae3890d30), [`7aad631`](https://github.com/mastra-ai/mastra/commit/7aad631b43bc10db77d5b8c66b200d7a49d18bf2), [`1794a79`](https://github.com/mastra-ai/mastra/commit/1794a79178c418004a7261b1ad9114066f7ef01d)]:
  - @mastra/core@1.60.0-alpha.3

## 1.2.2-alpha.2

### Patch Changes

- Updated dependencies [[`7e096f0`](https://github.com/mastra-ai/mastra/commit/7e096f02f0dddbf09b85d306458351245ed2f886), [`8f0a332`](https://github.com/mastra-ai/mastra/commit/8f0a3321bf180368d76fe7b36aa1a8f60f00b6de), [`b098de9`](https://github.com/mastra-ai/mastra/commit/b098de9d7cb9f672e0883a5c716465a3a689693d), [`ef6e295`](https://github.com/mastra-ai/mastra/commit/ef6e295b59bc25a5b61b633a89c97bcfce9fb465), [`208e1b3`](https://github.com/mastra-ai/mastra/commit/208e1b39f30f4b386e494394e9d71d96f0f90241), [`c938d34`](https://github.com/mastra-ai/mastra/commit/c938d34739936c8ecbabd67ad6a4a4396f41c4c6), [`1d9a0ea`](https://github.com/mastra-ai/mastra/commit/1d9a0ea4a9901baee6cd56737243bd6d1f631ac0), [`5c3e4d9`](https://github.com/mastra-ai/mastra/commit/5c3e4d9082b483e911c82baf1f3f4d4b27be5bc3), [`3667679`](https://github.com/mastra-ai/mastra/commit/3667679db057edfb086846d13369fdda4902ad65), [`49696e8`](https://github.com/mastra-ai/mastra/commit/49696e8e42f870674a0a58f5abcd22cc54dd2864), [`2d56f92`](https://github.com/mastra-ai/mastra/commit/2d56f922d4090fded13a68029d8eeed1a7857c79), [`512100a`](https://github.com/mastra-ai/mastra/commit/512100a7d8b7e9c920f2590c6b3612f5de0d3cff), [`9ef432b`](https://github.com/mastra-ai/mastra/commit/9ef432b6faa534b57b0d182a610e13dd9a7123ff), [`b9cf308`](https://github.com/mastra-ai/mastra/commit/b9cf30846f97f99ac1906ee8a68f4f2d117b0378)]:
  - @mastra/core@1.60.0-alpha.2
  - @mastra/pg@1.20.1-alpha.0
  - @mastra/duckdb@1.6.2-alpha.0

## 1.2.2-alpha.1

### Patch Changes

- Updated dependencies [[`15101bb`](https://github.com/mastra-ai/mastra/commit/15101bb53c0d934f31af6b8813b88191e382a5e5), [`c2c3deb`](https://github.com/mastra-ai/mastra/commit/c2c3debcf670c7082d0a5e553aa99818a864698c), [`d6c618f`](https://github.com/mastra-ai/mastra/commit/d6c618f37496f801827d4caa76feab742f1a7383), [`33374ba`](https://github.com/mastra-ai/mastra/commit/33374ba359e4fb13eaa918ae925fe167a3c55414), [`4c0b961`](https://github.com/mastra-ai/mastra/commit/4c0b9611e89c5097b7a02a28c6816e0adcbcfa09), [`c5f964d`](https://github.com/mastra-ai/mastra/commit/c5f964d3f77064e978f8066ec506eed77ba5c63c), [`f8f653f`](https://github.com/mastra-ai/mastra/commit/f8f653f10980d01a73706cc3c8689ca5e40ce808)]:
  - @mastra/core@1.60.0-alpha.1
  - @mastra/observability@1.17.1-alpha.0
  - @mastra/mcp@1.16.0

## 1.2.2-alpha.0

### Patch Changes

- Updated dependencies [[`587f6ef`](https://github.com/mastra-ai/mastra/commit/587f6efcfc25880b93760a8607d1cd381ec612fe)]:
  - @mastra/core@1.59.1-alpha.0

## 1.2.1

### Patch Changes

- Send opaque acting-user subjects with Platform sandbox requests, including Factory creation and reattachment flows. ([#20754](https://github.com/mastra-ai/mastra/pull/20754))

  ```typescript
  import { PlatformSandbox } from '@mastra/platform-workspace';

  const sandbox = new PlatformSandbox({
    environmentId: 'env_abc',
    actingUserId: auth.user.id,
  });
  ```

- Fixed memory growth from accumulated language servers by limiting retained workspace clients. ([#21186](https://github.com/mastra-ai/mastra/pull/21186))

- Updated dependencies [[`088e41e`](https://github.com/mastra-ai/mastra/commit/088e41e434ed05f2c674b254f1034ec46a57a7be), [`aa3e7be`](https://github.com/mastra-ai/mastra/commit/aa3e7be30f8addb0278ea74429f4df054517a287), [`d118873`](https://github.com/mastra-ai/mastra/commit/d118873cfd5074b1f814a1c169a97ca7a3a29174), [`b2f0013`](https://github.com/mastra-ai/mastra/commit/b2f0013375588d40c03c13e843b99c0ff8872ca5), [`3b541ae`](https://github.com/mastra-ai/mastra/commit/3b541ae5d410c52b80a7e381d84d021cddb9a449), [`79dd7c2`](https://github.com/mastra-ai/mastra/commit/79dd7c261ee6be1fafedd4651959394db21d2cba), [`90822db`](https://github.com/mastra-ai/mastra/commit/90822dba08fb2169c518e4a6d7f127c098eb46b8), [`898bba4`](https://github.com/mastra-ai/mastra/commit/898bba46d4806dd255a44e5dc3a3d5827eaefdfe), [`b9a28ec`](https://github.com/mastra-ai/mastra/commit/b9a28ecf7acdc0cb7a543d5b660f9fbee301df9a), [`2d1ec9e`](https://github.com/mastra-ai/mastra/commit/2d1ec9e6e349c7f05555a2ffcc79308cd96f48e2), [`f9aab1c`](https://github.com/mastra-ai/mastra/commit/f9aab1cfc3fda03238a7fd7bd8b794e07497878c), [`3700208`](https://github.com/mastra-ai/mastra/commit/37002080c7838267803a7e579a7d58b908d62f36), [`e31421b`](https://github.com/mastra-ai/mastra/commit/e31421bc9c11c03c6e74f447ecb5820000e2b9d7), [`8b7131e`](https://github.com/mastra-ai/mastra/commit/8b7131eb0407f58f5205e68fb27b81f026488f28), [`161258b`](https://github.com/mastra-ai/mastra/commit/161258b3473a6d0fce00a43cab59d119a49a232f), [`c48b764`](https://github.com/mastra-ai/mastra/commit/c48b764dfbe7e2f7ee6459e8ffc9f0df7b166474), [`f9aab1c`](https://github.com/mastra-ai/mastra/commit/f9aab1cfc3fda03238a7fd7bd8b794e07497878c), [`aece0e7`](https://github.com/mastra-ai/mastra/commit/aece0e7cb124ae1eb1230689b887f5554b9a0bf0), [`f82f22f`](https://github.com/mastra-ai/mastra/commit/f82f22f56c58ab90e8a7501aaa5039a4e13cfe8b), [`ae79e34`](https://github.com/mastra-ai/mastra/commit/ae79e34c0bd8674fc24c7524217bfc4a051c6136), [`59d8898`](https://github.com/mastra-ai/mastra/commit/59d8898c8cb48b342fe5bcb5eee803cc8cc95060), [`a6c4399`](https://github.com/mastra-ai/mastra/commit/a6c4399763590b3dae21a2c81826e89a3b1deee4), [`cf418b6`](https://github.com/mastra-ai/mastra/commit/cf418b65efb81997e9b8dc7638eee363c5d96c96), [`a40f915`](https://github.com/mastra-ai/mastra/commit/a40f9157690d89ef13ce825cc88e30be581de5d4), [`8ea8038`](https://github.com/mastra-ai/mastra/commit/8ea80386fde53d26e2c0b2060c53bc9bd9be10f3), [`be31796`](https://github.com/mastra-ai/mastra/commit/be3179624ad5f77cff5fa342cd08046bf7605283), [`ae79e34`](https://github.com/mastra-ai/mastra/commit/ae79e34c0bd8674fc24c7524217bfc4a051c6136), [`79c4f82`](https://github.com/mastra-ai/mastra/commit/79c4f8295f568752eeadf8a9b50010a7d9ec06ae), [`7dafa4f`](https://github.com/mastra-ai/mastra/commit/7dafa4f670fb16ec8ff07349645a00ca12bc5794)]:
  - @mastra/core@1.59.0
  - @mastra/observability@1.17.0
  - @mastra/stagehand@0.3.3
  - @mastra/memory@1.26.2
  - @mastra/schema-compat@1.3.7
  - @mastra/mcp@1.16.0

## 1.2.1-alpha.5

### Patch Changes

- Updated dependencies [[`c48b764`](https://github.com/mastra-ai/mastra/commit/c48b764dfbe7e2f7ee6459e8ffc9f0df7b166474), [`59d8898`](https://github.com/mastra-ai/mastra/commit/59d8898c8cb48b342fe5bcb5eee803cc8cc95060), [`a40f915`](https://github.com/mastra-ai/mastra/commit/a40f9157690d89ef13ce825cc88e30be581de5d4)]:
  - @mastra/stagehand@0.3.3-alpha.0
  - @mastra/core@1.59.0-alpha.5

## 1.2.1-alpha.4

### Patch Changes

- Send opaque acting-user subjects with Platform sandbox requests, including Factory creation and reattachment flows. ([#20754](https://github.com/mastra-ai/mastra/pull/20754))

  ```typescript
  import { PlatformSandbox } from '@mastra/platform-workspace';

  const sandbox = new PlatformSandbox({
    environmentId: 'env_abc',
    actingUserId: auth.user.id,
  });
  ```

- Updated dependencies [[`79dd7c2`](https://github.com/mastra-ai/mastra/commit/79dd7c261ee6be1fafedd4651959394db21d2cba), [`b9a28ec`](https://github.com/mastra-ai/mastra/commit/b9a28ecf7acdc0cb7a543d5b660f9fbee301df9a), [`be31796`](https://github.com/mastra-ai/mastra/commit/be3179624ad5f77cff5fa342cd08046bf7605283)]:
  - @mastra/core@1.59.0-alpha.4

## 1.2.1-alpha.3

### Patch Changes

- Updated dependencies [[`d118873`](https://github.com/mastra-ai/mastra/commit/d118873cfd5074b1f814a1c169a97ca7a3a29174), [`161258b`](https://github.com/mastra-ai/mastra/commit/161258b3473a6d0fce00a43cab59d119a49a232f), [`8ea8038`](https://github.com/mastra-ai/mastra/commit/8ea80386fde53d26e2c0b2060c53bc9bd9be10f3)]:
  - @mastra/core@1.59.0-alpha.3

## 1.2.1-alpha.2

### Patch Changes

- Updated dependencies [[`898bba4`](https://github.com/mastra-ai/mastra/commit/898bba46d4806dd255a44e5dc3a3d5827eaefdfe), [`2d1ec9e`](https://github.com/mastra-ai/mastra/commit/2d1ec9e6e349c7f05555a2ffcc79308cd96f48e2), [`f9aab1c`](https://github.com/mastra-ai/mastra/commit/f9aab1cfc3fda03238a7fd7bd8b794e07497878c), [`e31421b`](https://github.com/mastra-ai/mastra/commit/e31421bc9c11c03c6e74f447ecb5820000e2b9d7), [`f9aab1c`](https://github.com/mastra-ai/mastra/commit/f9aab1cfc3fda03238a7fd7bd8b794e07497878c), [`aece0e7`](https://github.com/mastra-ai/mastra/commit/aece0e7cb124ae1eb1230689b887f5554b9a0bf0), [`f82f22f`](https://github.com/mastra-ai/mastra/commit/f82f22f56c58ab90e8a7501aaa5039a4e13cfe8b)]:
  - @mastra/core@1.59.0-alpha.2
  - @mastra/observability@1.17.0-alpha.1
  - @mastra/memory@1.26.2-alpha.1
  - @mastra/mcp@1.16.0

## 1.2.1-alpha.1

### Patch Changes

- Fixed memory growth from accumulated language servers by limiting retained workspace clients. ([#21186](https://github.com/mastra-ai/mastra/pull/21186))

- Updated dependencies [[`aa3e7be`](https://github.com/mastra-ai/mastra/commit/aa3e7be30f8addb0278ea74429f4df054517a287), [`90822db`](https://github.com/mastra-ai/mastra/commit/90822dba08fb2169c518e4a6d7f127c098eb46b8), [`3700208`](https://github.com/mastra-ai/mastra/commit/37002080c7838267803a7e579a7d58b908d62f36), [`8b7131e`](https://github.com/mastra-ai/mastra/commit/8b7131eb0407f58f5205e68fb27b81f026488f28), [`cf418b6`](https://github.com/mastra-ai/mastra/commit/cf418b65efb81997e9b8dc7638eee363c5d96c96), [`79c4f82`](https://github.com/mastra-ai/mastra/commit/79c4f8295f568752eeadf8a9b50010a7d9ec06ae)]:
  - @mastra/core@1.59.0-alpha.1
  - @mastra/schema-compat@1.3.7-alpha.0
  - @mastra/mcp@1.16.0
  - @mastra/memory@1.26.2-alpha.0

## 1.2.1-alpha.0

### Patch Changes

- Updated dependencies [[`088e41e`](https://github.com/mastra-ai/mastra/commit/088e41e434ed05f2c674b254f1034ec46a57a7be), [`b2f0013`](https://github.com/mastra-ai/mastra/commit/b2f0013375588d40c03c13e843b99c0ff8872ca5), [`3b541ae`](https://github.com/mastra-ai/mastra/commit/3b541ae5d410c52b80a7e381d84d021cddb9a449), [`ae79e34`](https://github.com/mastra-ai/mastra/commit/ae79e34c0bd8674fc24c7524217bfc4a051c6136), [`a6c4399`](https://github.com/mastra-ai/mastra/commit/a6c4399763590b3dae21a2c81826e89a3b1deee4), [`ae79e34`](https://github.com/mastra-ai/mastra/commit/ae79e34c0bd8674fc24c7524217bfc4a051c6136)]:
  - @mastra/core@1.59.0-alpha.0
  - @mastra/observability@1.17.0-alpha.0
  - @mastra/mcp@1.16.0

## 1.2.0

### Minor Changes

- Added Dynamic Workflow creation and management to Mastra Code, including discovery-backed authoring, immediate persistence, execution, and deletion. ([#21210](https://github.com/mastra-ai/mastra/pull/21210))

  ```ts
  import { listWorkflows, runWorkflow } from '@mastra/code-sdk/workflows/service';

  const { workflows } = await listWorkflows(mastra);
  const workflow = workflows[0];
  if (workflow) {
    await runWorkflow(mastra, workflow.id, { topic: 'dynamic workflows' });
  }
  ```

- Added `processors` and `signalProviders` to the Mastra Code plugin contract, so a plugin can contribute more than tools. ([#20848](https://github.com/mastra-ai/mastra/pull/20848))

  **Processors**

  A plugin can now extend the agent pipeline directly, passing a bare array for input processors or an object for both lanes. Plugin processors run after the processors Mastra Code configures and before the channel and memory layers the Agent appends. The slot isn't configurable, and the processors are resolved before every LLM call. Enabling, disabling, or updating a plugin applies on the next request instead of requiring a restart.

  **Signal providers**

  A plugin can also ship a signal provider, which monitors an external source and pushes notifications into a thread. Providers are long-lived, so the SDK owns their lifecycle instead of handing them to the agent: it registers Mastra on them, connects them to the coding agent, starts them polling, and stops them when the plugin is updated, disabled, or uninstalled. That makes a provider installed from a GitHub repository survive a mid-session update of that repository. Only one provider with a given id runs at a time, and a provider that fails to start is isolated from the rest of its plugin.

  Field resolvers also receive `getController()` and `getActiveSession()` on the plugin context, so a plugin can read the running session lazily at the moment it needs it.

  For embedders that inject their own `pluginManager` into `createMastraCode`: the `PluginManager` contract now also requires `onReload`, `getPluginSignalProviders`, and `setRuntime`, so hand-built manager implementations must add these methods.

- Add a reasoning-effort configuration surface across mastracode and Factory (fixes #20766): ([#20884](https://github.com/mastra-ai/mastra/pull/20884))

  - New `max` thinking level (mapped to `reasoning effort: max` for OpenAI Codex and Anthropic `effort`).
  - Anthropic extended-thinking wiring: the session thinking level now applies to anthropic/claude-opus-4-7 and other Anthropic models via provider thinking/effort options (previously OpenAI-only).
  - New `models.modeThinkingDefaults` setting: per-mode (build/plan/fast) default thinking levels, resolved at request time with precedence session override → mode default → global `preferences.thinkingLevel`. Configuration changes now apply to the next request of every session, including automated Factory runs.
  - Factory: new Settings → Defaults controls for editing global and per-mode thinking defaults in local deployments.
  - TUI: `/think` now sets a session-only override, supports `/think default` to clear it, and `/think status` reports the effective level with provenance (session override / mode default / global default).

  Example `settings.json` configuration:

  ```json
  {
    "preferences": { "thinkingLevel": "medium" },
    "models": {
      "modeThinkingDefaults": {
        "build": "high",
        "plan": "max",
        "fast": "off"
      }
    }
  }
  ```

- Added MCP disable-state controls to the MCP manager. Servers can be disabled for the current project or for every project, the state persists across runs in an app-data `mcp-state.json` (user MCP config files are never mutated), and disabled servers stay visible in statuses via the new `disabled`/`disabledScope` fields on `McpServerStatus`. ([#20834](https://github.com/mastra-ai/mastra/pull/20834))

  ```ts
  await mcpManager.setServerDisabled('filesystem', true); // project scope
  await mcpManager.setServerDisabled('filesystem', true, { global: true }); // all projects
  await mcpManager.setAllDisabled(true, { global: true }); // global kill switch
  mcpManager.isAllDisabledGlobally();
  mcpManager.getDisabledServers();
  ```

### Patch Changes

- dependencies updates: ([#19783](https://github.com/mastra-ai/mastra/pull/19783))
  - Updated dependency [`posthog-node@^5.46.1` ↗︎](https://www.npmjs.com/package/posthog-node/v/5.46.1) (from `^5.37.0`, in `dependencies`)

- dependencies updates: ([#20406](https://github.com/mastra-ai/mastra/pull/20406))
  - Updated dependency [`@aws-sdk/credential-providers@^3.1095.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/credential-providers/v/3.1095.0) (from `^3.864.0`, in `dependencies`)

- Persist the browser viewport as a preset name, a `{ width, height }` size, or `'window'` in settings, and drop unusable stored values back to the default rather than passing them to the browser. ([#21010](https://github.com/mastra-ai/mastra/pull/21010))

- Fixed tenant credential resolution for session-based authentication providers. Background Factory runs now resolve the authenticated user and active organization from session-wrapped request context values instead of falling back to an empty credential store. ([#21008](https://github.com/mastra-ai/mastra/pull/21008))

- Added a `model` option to Stagehand browser settings, so browser automation can run on a chosen provider instead of a fixed default: ([#20993](https://github.com/mastra-ai/mastra/pull/20993))

  ```ts
  import { createBrowserFromSettings } from '@mastra/code-sdk/onboarding/settings';

  const browser = await createBrowserFromSettings({
    enabled: true,
    provider: 'stagehand',
    headless: true,
    stagehand: { env: 'LOCAL', model: 'anthropic/claude-sonnet-4-5' },
  });
  ```

  The model must be provider-qualified as `<provider>/<model>`. Values Stagehand cannot resolve, such as a bare `gpt-4.1`, are ignored so the browser still starts.

- Fixed woken notifications running against the controller-level workspace, which is `undefined` for dynamic workspace factories. They now use the workspace of the session that owns the target thread. ([#21144](https://github.com/mastra-ai/mastra/pull/21144))

- Fixed deferred notification deliveries failing with "No model selected" when the woken thread had no request context. The notification dispatch workflow re-sends deferred and summarized notifications long after the originating send, so any stream options attached to the original signal are gone; waking an idle thread then had no way to resolve a model. The notification delivery policy now drives the fix: `NotificationDeliveryDecision` accepts `streamOptions`, and the dispatcher re-runs the agent's delivery policy at delivery time (via the new `agent.resolveNotificationDeliveryDecision()`) to attach freshly resolved stream options to both individual and summary deliveries. Only `streamOptions` is honored at dispatch time; the record's persisted schedule still governs when and how it is delivered. Receipt-time sends also honor the policy's `streamOptions` now: an immediate deliver or summarize-now wake attaches them too, with caller-supplied stream options taking precedence. Mastra Code wires its session-based stream options resolver through the Code Agent's `deliveryPolicy.decide`, layered on the default decision logic. This fix applies to threads whose session is live in the current process; deliveries with no resolvable session fall back to a bare wake, and the "No model selected" error now distinguishes the case where a run started without any controller session context. This re-lands the capability removed by the #18637 revert in the policy-driven shape that revert called for, and the `@mastra/github-signals` bump only widens its `getNotificationStreamOptions` callback return type to allow `undefined`. ([#21113](https://github.com/mastra-ai/mastra/pull/21113))

- Fixed custom provider models saved with a stray `mastracode/` prefix in settings, which broke selecting and using them after choosing them from `/models` (#20799) ([#20804](https://github.com/mastra-ai/mastra/pull/20804))

- Fixed authentication failures for unprefixed direct-provider models by using provider environment credentials when no provider-specific stored credential exists. ([#21197](https://github.com/mastra-ai/mastra/pull/21197))

- Fixed Factory interactive plans so they are stored as browsable artifacts. ([#21173](https://github.com/mastra-ai/mastra/pull/21173))

- Include worktree identity (`worktree_path`, `branch`, `main_repo_path`) in `SessionStart` and `SessionEnd` hook payloads when a session runs in a git worktree, so hooks can provision and tear down per-worktree resources. ([#21034](https://github.com/mastra-ai/mastra/pull/21034))

- Updated dependencies [[`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`b8ce7ec`](https://github.com/mastra-ai/mastra/commit/b8ce7ec96e39343c6c2f36d12d68a9ad816c09f7), [`2e4624e`](https://github.com/mastra-ai/mastra/commit/2e4624edb6917e61249cb60ee377735e7af7e4a9), [`45a9147`](https://github.com/mastra-ai/mastra/commit/45a914741f578754d79d8b7de7b4e4f304d8e14a), [`a3a3624`](https://github.com/mastra-ai/mastra/commit/a3a3624f646b98e409424d8defccbd334da9e8b8), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`6246914`](https://github.com/mastra-ai/mastra/commit/62469146636911f3cbbe0880bd011c6a897a59a7), [`6445eba`](https://github.com/mastra-ai/mastra/commit/6445eba6020abac681aba1cc9289f446cb400cbe), [`1315d8f`](https://github.com/mastra-ai/mastra/commit/1315d8f17e8e7acb61cca46b72a1d42f6d00d289), [`86b7b77`](https://github.com/mastra-ai/mastra/commit/86b7b777980d30f66e1fd134a37d2af4c22e54cc), [`1c75e32`](https://github.com/mastra-ai/mastra/commit/1c75e32f7fc0b9fb6f548b4407feaec8a1440212), [`296dc9a`](https://github.com/mastra-ai/mastra/commit/296dc9af29f3616e786c7825ec32e0df92d754c5), [`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`1bdfde1`](https://github.com/mastra-ai/mastra/commit/1bdfde1f4061b7c0550253a1512a2118debe7996), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`3f73c07`](https://github.com/mastra-ai/mastra/commit/3f73c076727e8c36b4fff7a1b40290fb68957fa8), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`6bff877`](https://github.com/mastra-ai/mastra/commit/6bff877e214695ff8d9c84b06c13a6e6bcf9f1ed), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`d7cf7fa`](https://github.com/mastra-ai/mastra/commit/d7cf7fafc1ae1b50bd8462dd0e6c671a8606db93), [`7c1ebb1`](https://github.com/mastra-ai/mastra/commit/7c1ebb15690c4b3f0eabb19077cf8af573311e57), [`0f9a448`](https://github.com/mastra-ai/mastra/commit/0f9a448502157e59f7b76f24360ad497168f5ef8), [`f5a17d9`](https://github.com/mastra-ai/mastra/commit/f5a17d95c19e7d4149996932bd8d1905089f031d), [`578bf2e`](https://github.com/mastra-ai/mastra/commit/578bf2e6a88e9d5b8bf502204e15a95dfbb679ae), [`c47165c`](https://github.com/mastra-ai/mastra/commit/c47165c983c87594c6952f1fd2fa51a90205034c), [`289f4ce`](https://github.com/mastra-ai/mastra/commit/289f4ce16e3293370440172132c52ee787cbc09f), [`deaf0c4`](https://github.com/mastra-ai/mastra/commit/deaf0c4c38fe2e988a094c63bbd8899436f4e579), [`df31eb0`](https://github.com/mastra-ai/mastra/commit/df31eb0c7087d782a0d9346e467f9a4af4b0eef6), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`4f16ff8`](https://github.com/mastra-ai/mastra/commit/4f16ff824bf2f9b0ddc93f210477c10c8a4fb1ab), [`b4c89b4`](https://github.com/mastra-ai/mastra/commit/b4c89b4371b0c86da57403ad1a3b3ef0681f3128), [`e6534fa`](https://github.com/mastra-ai/mastra/commit/e6534fab031216f6cb48c4c9907cbfdce9d60bc6), [`210cb7a`](https://github.com/mastra-ai/mastra/commit/210cb7a167998c7bbf72cb3b93e6eb0563330239), [`06b2d87`](https://github.com/mastra-ai/mastra/commit/06b2d87e63bcdd0ed59215c6789692b9b12de376), [`1c67d85`](https://github.com/mastra-ai/mastra/commit/1c67d85e9da8285662f4dbbf47e0378c3fee0747), [`ac01d63`](https://github.com/mastra-ai/mastra/commit/ac01d6355974aec73fdb8781449ed12bac582094), [`8627c23`](https://github.com/mastra-ai/mastra/commit/8627c23d794485fb97d533fc2a7a8323bfec2225), [`03ebe06`](https://github.com/mastra-ai/mastra/commit/03ebe06aeb671d7127b700e53853ed0759e4c19f), [`80a3324`](https://github.com/mastra-ai/mastra/commit/80a33245d3110204de6f56d61211523ffe338692), [`e44e8f3`](https://github.com/mastra-ai/mastra/commit/e44e8f370b66c339ddcaba946d33da6d3c3f06cd), [`d9d2881`](https://github.com/mastra-ai/mastra/commit/d9d2881ede6dd6c023d144215fc812062aed0890), [`a810a05`](https://github.com/mastra-ai/mastra/commit/a810a058f62ad407cfc1701e0be36ae91145d7cf), [`ba24be6`](https://github.com/mastra-ai/mastra/commit/ba24be662439c331ab23a600041f93803c89eca8), [`842b5fe`](https://github.com/mastra-ai/mastra/commit/842b5fe22b6a7fa811bd14e48eb9af523ac989f2), [`26ff3b9`](https://github.com/mastra-ai/mastra/commit/26ff3b9144132bd8570e4796d436fb57a9a2bf24), [`3ff2be3`](https://github.com/mastra-ai/mastra/commit/3ff2be3a5a579d2e2d7084ba0624ec24faadce4d), [`990611b`](https://github.com/mastra-ai/mastra/commit/990611ba76eb876d86c9c594371ae5f02f94b432), [`80bdf3a`](https://github.com/mastra-ai/mastra/commit/80bdf3ae16ade6ff63bde0cb16fa2df8ab7dd4dd), [`c967a5e`](https://github.com/mastra-ai/mastra/commit/c967a5eec150c5dc5418c4a4388982d1fb7ad27c), [`195e83c`](https://github.com/mastra-ai/mastra/commit/195e83c077687f6016fd8090324975c8d8cea50b), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`9ba1247`](https://github.com/mastra-ai/mastra/commit/9ba12470c77f1c03642d720ce67e517e878f666e), [`fd96298`](https://github.com/mastra-ai/mastra/commit/fd96298a8367622f4ebfcaa97b5b6c1fbbd14564), [`66bbfb5`](https://github.com/mastra-ai/mastra/commit/66bbfb5f05b473d39f88c0e4a481ccac41634f3a), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`f8da216`](https://github.com/mastra-ai/mastra/commit/f8da21633e7eb0e31c9ce0fc30567870d19416d3), [`9168b80`](https://github.com/mastra-ai/mastra/commit/9168b80120a82816b1b9f2385e788bf86fa5d9cd), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`4a09a9c`](https://github.com/mastra-ai/mastra/commit/4a09a9c0474ef643558fcb5f0edc542b82f1cab0), [`5f798b3`](https://github.com/mastra-ai/mastra/commit/5f798b3362e9bdf4d690f85245606e146eef60b9), [`6a84954`](https://github.com/mastra-ai/mastra/commit/6a84954a2667f85b6d59da652dab1bbff007ccb0), [`1e83a47`](https://github.com/mastra-ai/mastra/commit/1e83a4734ab61ba5926af6793e3569a78b72ed37), [`52d8ef0`](https://github.com/mastra-ai/mastra/commit/52d8ef03801f1deb7ee48532fc4190dd4a33916c), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`7fdcaa6`](https://github.com/mastra-ai/mastra/commit/7fdcaa66105d64290f9b14432a12ec99f39c4d3a), [`d6c56f9`](https://github.com/mastra-ai/mastra/commit/d6c56f951db3213330b98b0abafa9778c8770e58), [`e08e789`](https://github.com/mastra-ai/mastra/commit/e08e789c1bf4cd2fe46363f7a4728536ceccc9bd), [`bf936e2`](https://github.com/mastra-ai/mastra/commit/bf936e2c89b2ff0dad5695b873ddc009ba96d41e), [`7fb580a`](https://github.com/mastra-ai/mastra/commit/7fb580ac73fbcacf2ff00872a3395f73ae1b9fa5), [`59866f2`](https://github.com/mastra-ai/mastra/commit/59866f2e0a7986bea3b418aaa2c2f79a77d33719), [`ed5d606`](https://github.com/mastra-ai/mastra/commit/ed5d606739c5e3fbdfa9f272df7809aa5ab43b1d), [`c71e307`](https://github.com/mastra-ai/mastra/commit/c71e3077e69eae3f25aa628e3778f153a9d6ab36), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`289f4ce`](https://github.com/mastra-ai/mastra/commit/289f4ce16e3293370440172132c52ee787cbc09f), [`f53d5bd`](https://github.com/mastra-ai/mastra/commit/f53d5bd4885b29e4ac29a428a6044088ea8d6aa3), [`32980a3`](https://github.com/mastra-ai/mastra/commit/32980a3e2413d0274ac244d32c37d910edc13f00), [`a4f6806`](https://github.com/mastra-ai/mastra/commit/a4f68065d082af57770e7ee3d34996fdc914dbd1), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`82e3365`](https://github.com/mastra-ai/mastra/commit/82e3365ef7c9bf7bee2e7a7029035ea262d68895), [`6104347`](https://github.com/mastra-ai/mastra/commit/61043473ba6bfd0a25156824e853e13165562e6c), [`261edb9`](https://github.com/mastra-ai/mastra/commit/261edb9bc0cfbed2b77090b87562307a360f1a04), [`35cc901`](https://github.com/mastra-ai/mastra/commit/35cc90102cf834a84827acaf9eee0b6d6d1e2a3b), [`a8b4cf0`](https://github.com/mastra-ai/mastra/commit/a8b4cf02823cffebc4751a53337dfacf097c1ae1), [`a53f19b`](https://github.com/mastra-ai/mastra/commit/a53f19b9badb8bd349fe2f885814e9db6b7d3c4b), [`edfe906`](https://github.com/mastra-ai/mastra/commit/edfe906f7926faf8c63c21b3c87e797985557feb), [`ffdfa25`](https://github.com/mastra-ai/mastra/commit/ffdfa25b5cdf3ecfd0c5a2e96363c3ba50995ce9), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`65b1183`](https://github.com/mastra-ai/mastra/commit/65b11832834f87a9bc8719391deb27559de5138a), [`333785c`](https://github.com/mastra-ai/mastra/commit/333785c93cbb01e42c60167e995457c28897ddbf), [`bda2235`](https://github.com/mastra-ai/mastra/commit/bda22353ee28f2df0eaea555f7cae1549f979c0b), [`efd5c81`](https://github.com/mastra-ai/mastra/commit/efd5c81cc25fde3c2ddd86fc1178deb4ec176e19), [`1b482c2`](https://github.com/mastra-ai/mastra/commit/1b482c2d89244dd758c41e5f927a2b44041388d2), [`5dba2a4`](https://github.com/mastra-ai/mastra/commit/5dba2a41600385751f5aace79878904e1972609d), [`45bfb88`](https://github.com/mastra-ai/mastra/commit/45bfb88fd52f1dd3be20e2a38905777c96499c90), [`ff28284`](https://github.com/mastra-ai/mastra/commit/ff2828416f14daff9d956e6a352fdaa23c950979), [`4bcdfaf`](https://github.com/mastra-ai/mastra/commit/4bcdfaf0eac3199d7cb171b0a19a92c9c341eea4), [`e3b9307`](https://github.com/mastra-ai/mastra/commit/e3b9307098daefbfae2a52ae2ef51bc9fc701190), [`d6834c5`](https://github.com/mastra-ai/mastra/commit/d6834c5a7866b16734d23900163c2414ed70d791), [`43ea2a1`](https://github.com/mastra-ai/mastra/commit/43ea2a1f5c5867d0f41254047a786e96cd00798b), [`f33264f`](https://github.com/mastra-ai/mastra/commit/f33264f517ae603279afd5c4251e2b40f6dd3618), [`689f2c4`](https://github.com/mastra-ai/mastra/commit/689f2c4b6c0835fe455702b01d21daa8abcd9331), [`fcd0667`](https://github.com/mastra-ai/mastra/commit/fcd0667a4e378be35c9a1b1eb19cce78fbfd7282), [`cfd0d9e`](https://github.com/mastra-ai/mastra/commit/cfd0d9ec77ec3c69dd96f79cdb579e03d79f22ce), [`acc3513`](https://github.com/mastra-ai/mastra/commit/acc3513b19f79bf0a7ec2998694580edca54086c), [`1670533`](https://github.com/mastra-ai/mastra/commit/1670533986f6bacf567746245348125e3a106448), [`a7eb4a1`](https://github.com/mastra-ai/mastra/commit/a7eb4a11450f6170274ed5141bffe821d4fdd5a6), [`1b1dd7b`](https://github.com/mastra-ai/mastra/commit/1b1dd7bc0e59b7a8bfabd09a3eec1ccd95b4c2f3), [`0976933`](https://github.com/mastra-ai/mastra/commit/0976933142333ec78451feef265b68bcb45aa5e7), [`242b945`](https://github.com/mastra-ai/mastra/commit/242b94558777bfbdeb42cbfea84afff0b6ad0633), [`c52d346`](https://github.com/mastra-ai/mastra/commit/c52d3462ec831a5d95926ecd3d3373f5928ad2e5), [`af4636a`](https://github.com/mastra-ai/mastra/commit/af4636a74463275d71c1d13a38f7d2b738f128bf), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`2eabc09`](https://github.com/mastra-ai/mastra/commit/2eabc097d86d52fbd0123da36a7c874154cc384f), [`0023e79`](https://github.com/mastra-ai/mastra/commit/0023e7919431078280abd11c89d1edeae35fcc69), [`c2ad51e`](https://github.com/mastra-ai/mastra/commit/c2ad51e2467f901eecba8c9f4a45e22a50bd7c18), [`25ca73d`](https://github.com/mastra-ai/mastra/commit/25ca73d25dee7ce9f0ca72939e3a505c4db7257e), [`2f9ef3f`](https://github.com/mastra-ai/mastra/commit/2f9ef3f4ca06fc2dcdd5088c26b7f4da6a016791), [`e7eefcb`](https://github.com/mastra-ai/mastra/commit/e7eefcb162cda7c493e8c3bf43050ead0efbcb2c), [`fea5cae`](https://github.com/mastra-ai/mastra/commit/fea5caedc7e2cfea51784a15e015952692027abf), [`4d7aca2`](https://github.com/mastra-ai/mastra/commit/4d7aca2fe75f225c83d1502d63079568e6ec163f), [`e1cead1`](https://github.com/mastra-ai/mastra/commit/e1cead17b5f3653cf00d2f90cc19b113119c02ba), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`25956fc`](https://github.com/mastra-ai/mastra/commit/25956fc8841780d506acb22b618fdb4dcf6c4e21), [`d9d93b2`](https://github.com/mastra-ai/mastra/commit/d9d93b25e4a65ad5fa153fa35be7ed149c8d587f), [`c4ec889`](https://github.com/mastra-ai/mastra/commit/c4ec889561c0264c43f66d04d587bee4ce35e792), [`4b59f78`](https://github.com/mastra-ai/mastra/commit/4b59f786cbc9a7d1ef07a07517dbd4b96865e99d), [`eeae63e`](https://github.com/mastra-ai/mastra/commit/eeae63e7fbe8e1f237adc69bca6e2ac13c5ca907), [`3dc97ea`](https://github.com/mastra-ai/mastra/commit/3dc97ea415fad353b48a13095fad1835933cc12a), [`9ba1247`](https://github.com/mastra-ai/mastra/commit/9ba12470c77f1c03642d720ce67e517e878f666e), [`94e7ae9`](https://github.com/mastra-ai/mastra/commit/94e7ae970b37c888cd1244ef013292639a2fe6d1), [`d97107a`](https://github.com/mastra-ai/mastra/commit/d97107a7edc517ae8feddf914fc43cd80a66c0a8), [`e6a2860`](https://github.com/mastra-ai/mastra/commit/e6a2860649cc51f87d32d78b766ae2126446ba07), [`7010c5d`](https://github.com/mastra-ai/mastra/commit/7010c5d15728bf9c5dfe4fb6b1bf80ce23bf143a), [`bab06b1`](https://github.com/mastra-ai/mastra/commit/bab06b18923873a584bdfc71a6b4ec7fb4727fb7), [`3d01cd3`](https://github.com/mastra-ai/mastra/commit/3d01cd387321b6f9c5cac31d487c84bf51b19c78), [`7bf3086`](https://github.com/mastra-ai/mastra/commit/7bf308663f0115ca74ad20554ade740f06640859), [`4c186a0`](https://github.com/mastra-ai/mastra/commit/4c186a017275f45e6ed4c09de0f89550e2d09e8c), [`b0fa077`](https://github.com/mastra-ai/mastra/commit/b0fa077bcbc9b08551846fe372a0d3d15b71ed72), [`0282e16`](https://github.com/mastra-ai/mastra/commit/0282e16115538c8e9b248b90f0748eb01cb5dc98), [`a8dd139`](https://github.com/mastra-ai/mastra/commit/a8dd1391a9fe9a6632c25809ef236980afa9a020), [`6a667b4`](https://github.com/mastra-ai/mastra/commit/6a667b4b7cd6a93fe41fcdd357b08c5a8c09b9ab), [`9be8878`](https://github.com/mastra-ai/mastra/commit/9be8878dcf0388e84fc4873e0eec27bd49b881a4), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`2440e09`](https://github.com/mastra-ai/mastra/commit/2440e096ea6c2def1ccc1eb2d0f3f5b88c4af940), [`d6c63e4`](https://github.com/mastra-ai/mastra/commit/d6c63e4b757babb95a735d0e421d4dac67c1dcf1), [`2093fbd`](https://github.com/mastra-ai/mastra/commit/2093fbd53bb744bae19ec89f6d73db9a66fbe8a7), [`a59049b`](https://github.com/mastra-ai/mastra/commit/a59049b1652a13efff66ac826326b5ed9a550342), [`7bd85ea`](https://github.com/mastra-ai/mastra/commit/7bd85ea7588b71c25ce9f4019c88f8539be5dcbc), [`83fa004`](https://github.com/mastra-ai/mastra/commit/83fa0044bfda8b703a83883dbd8bef204844d13f), [`a463cdf`](https://github.com/mastra-ai/mastra/commit/a463cdf1c95c3059e70f0bff27959e8558bb899d), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`e4d3761`](https://github.com/mastra-ai/mastra/commit/e4d376143cf3322885a7e6e4048e536ce441f785), [`7b4393d`](https://github.com/mastra-ai/mastra/commit/7b4393d557411fdcf07b0e30e5acaf7cc85154ae), [`0ea6b80`](https://github.com/mastra-ai/mastra/commit/0ea6b8001408ce02b56e8be0536b0fd8cbaf8ad2)]:
  - @mastra/core@1.58.0
  - @mastra/libsql@1.20.0
  - @mastra/pg@1.20.0
  - @mastra/github-signals@0.2.5
  - @mastra/agent-browser@0.5.1
  - @mastra/stagehand@0.3.2
  - @mastra/observability@1.16.6
  - @mastra/schema-compat@1.3.6
  - @mastra/memory@1.26.1
  - @mastra/mcp@1.16.0
  - @mastra/duckdb@1.6.1

## 1.2.0-alpha.18

### Minor Changes

- Added Dynamic Workflow creation and management to Mastra Code, including discovery-backed authoring, immediate persistence, execution, and deletion. ([#21210](https://github.com/mastra-ai/mastra/pull/21210))

  ```ts
  import { listWorkflows, runWorkflow } from '@mastra/code-sdk/workflows/service';

  const { workflows } = await listWorkflows(mastra);
  const workflow = workflows[0];
  if (workflow) {
    await runWorkflow(mastra, workflow.id, { topic: 'dynamic workflows' });
  }
  ```

### Patch Changes

- Updated dependencies [[`296dc9a`](https://github.com/mastra-ai/mastra/commit/296dc9af29f3616e786c7825ec32e0df92d754c5), [`4a09a9c`](https://github.com/mastra-ai/mastra/commit/4a09a9c0474ef643558fcb5f0edc542b82f1cab0), [`1e83a47`](https://github.com/mastra-ai/mastra/commit/1e83a4734ab61ba5926af6793e3569a78b72ed37), [`ff28284`](https://github.com/mastra-ai/mastra/commit/ff2828416f14daff9d956e6a352fdaa23c950979), [`1670533`](https://github.com/mastra-ai/mastra/commit/1670533986f6bacf567746245348125e3a106448)]:
  - @mastra/core@1.58.0-alpha.16

## 1.2.0-alpha.17

### Patch Changes

- Updated dependencies [[`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b)]:
  - @mastra/memory@1.26.1-alpha.7
  - @mastra/core@1.58.0-alpha.15
  - @mastra/libsql@1.20.0-alpha.3
  - @mastra/pg@1.20.0-alpha.4

## 1.2.0-alpha.16

### Patch Changes

- Updated dependencies [[`210cb7a`](https://github.com/mastra-ai/mastra/commit/210cb7a167998c7bbf72cb3b93e6eb0563330239), [`5f798b3`](https://github.com/mastra-ai/mastra/commit/5f798b3362e9bdf4d690f85245606e146eef60b9), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`25ca73d`](https://github.com/mastra-ai/mastra/commit/25ca73d25dee7ce9f0ca72939e3a505c4db7257e), [`e1cead1`](https://github.com/mastra-ai/mastra/commit/e1cead17b5f3653cf00d2f90cc19b113119c02ba), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`d97107a`](https://github.com/mastra-ai/mastra/commit/d97107a7edc517ae8feddf914fc43cd80a66c0a8)]:
  - @mastra/core@1.58.0-alpha.14
  - @mastra/observability@1.16.6-alpha.4
  - @mastra/mcp@1.16.0-alpha.2

## 1.2.0-alpha.15

### Patch Changes

- Fixed authentication failures for unprefixed direct-provider models by using provider environment credentials when no provider-specific stored credential exists. ([#21197](https://github.com/mastra-ai/mastra/pull/21197))

- Updated dependencies [[`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`d6c56f9`](https://github.com/mastra-ai/mastra/commit/d6c56f951db3213330b98b0abafa9778c8770e58), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`acc3513`](https://github.com/mastra-ai/mastra/commit/acc3513b19f79bf0a7ec2998694580edca54086c), [`94e7ae9`](https://github.com/mastra-ai/mastra/commit/94e7ae970b37c888cd1244ef013292639a2fe6d1), [`6a667b4`](https://github.com/mastra-ai/mastra/commit/6a667b4b7cd6a93fe41fcdd357b08c5a8c09b9ab), [`2440e09`](https://github.com/mastra-ai/mastra/commit/2440e096ea6c2def1ccc1eb2d0f3f5b88c4af940), [`a59049b`](https://github.com/mastra-ai/mastra/commit/a59049b1652a13efff66ac826326b5ed9a550342)]:
  - @mastra/core@1.58.0-alpha.13

## 1.2.0-alpha.14

### Patch Changes

- Fixed Factory interactive plans so they are stored as browsable artifacts. ([#21173](https://github.com/mastra-ai/mastra/pull/21173))

## 1.2.0-alpha.13

### Patch Changes

- Fixed woken notifications running against the controller-level workspace, which is `undefined` for dynamic workspace factories. They now use the workspace of the session that owns the target thread. ([#21144](https://github.com/mastra-ai/mastra/pull/21144))

- Updated dependencies [[`2e4624e`](https://github.com/mastra-ai/mastra/commit/2e4624edb6917e61249cb60ee377735e7af7e4a9), [`e6534fa`](https://github.com/mastra-ai/mastra/commit/e6534fab031216f6cb48c4c9907cbfdce9d60bc6), [`7fdcaa6`](https://github.com/mastra-ai/mastra/commit/7fdcaa66105d64290f9b14432a12ec99f39c4d3a), [`65b1183`](https://github.com/mastra-ai/mastra/commit/65b11832834f87a9bc8719391deb27559de5138a), [`5dba2a4`](https://github.com/mastra-ai/mastra/commit/5dba2a41600385751f5aace79878904e1972609d), [`cfd0d9e`](https://github.com/mastra-ai/mastra/commit/cfd0d9ec77ec3c69dd96f79cdb579e03d79f22ce), [`d9d93b2`](https://github.com/mastra-ai/mastra/commit/d9d93b25e4a65ad5fa153fa35be7ed149c8d587f)]:
  - @mastra/core@1.58.0-alpha.12
  - @mastra/observability@1.16.6-alpha.3
  - @mastra/schema-compat@1.3.6-alpha.3
  - @mastra/mcp@1.16.0-alpha.2
  - @mastra/memory@1.26.1-alpha.6

## 1.2.0-alpha.12

### Minor Changes

- Added `processors` and `signalProviders` to the Mastra Code plugin contract, so a plugin can contribute more than tools. ([#20848](https://github.com/mastra-ai/mastra/pull/20848))

  **Processors**

  A plugin can now extend the agent pipeline directly, passing a bare array for input processors or an object for both lanes. Plugin processors run after the processors Mastra Code configures and before the channel and memory layers the Agent appends. The slot isn't configurable, and the processors are resolved before every LLM call. Enabling, disabling, or updating a plugin applies on the next request instead of requiring a restart.

  **Signal providers**

  A plugin can also ship a signal provider, which monitors an external source and pushes notifications into a thread. Providers are long-lived, so the SDK owns their lifecycle instead of handing them to the agent: it registers Mastra on them, connects them to the coding agent, starts them polling, and stops them when the plugin is updated, disabled, or uninstalled. That makes a provider installed from a GitHub repository survive a mid-session update of that repository. Only one provider with a given id runs at a time, and a provider that fails to start is isolated from the rest of its plugin.

  Field resolvers also receive `getController()` and `getActiveSession()` on the plugin context, so a plugin can read the running session lazily at the moment it needs it.

  For embedders that inject their own `pluginManager` into `createMastraCode`: the `PluginManager` contract now also requires `onReload`, `getPluginSignalProviders`, and `setRuntime`, so hand-built manager implementations must add these methods.

### Patch Changes

- Fixed deferred notification deliveries failing with "No model selected" when the woken thread had no request context. The notification dispatch workflow re-sends deferred and summarized notifications long after the originating send, so any stream options attached to the original signal are gone; waking an idle thread then had no way to resolve a model. The notification delivery policy now drives the fix: `NotificationDeliveryDecision` accepts `streamOptions`, and the dispatcher re-runs the agent's delivery policy at delivery time (via the new `agent.resolveNotificationDeliveryDecision()`) to attach freshly resolved stream options to both individual and summary deliveries. Only `streamOptions` is honored at dispatch time; the record's persisted schedule still governs when and how it is delivered. Receipt-time sends also honor the policy's `streamOptions` now: an immediate deliver or summarize-now wake attaches them too, with caller-supplied stream options taking precedence. Mastra Code wires its session-based stream options resolver through the Code Agent's `deliveryPolicy.decide`, layered on the default decision logic. This fix applies to threads whose session is live in the current process; deliveries with no resolvable session fall back to a bare wake, and the "No model selected" error now distinguishes the case where a run started without any controller session context. This re-lands the capability removed by the #18637 revert in the policy-driven shape that revert called for, and the `@mastra/github-signals` bump only widens its `getNotificationStreamOptions` callback return type to allow `undefined`. ([#21113](https://github.com/mastra-ai/mastra/pull/21113))

- Updated dependencies [[`b8ce7ec`](https://github.com/mastra-ai/mastra/commit/b8ce7ec96e39343c6c2f36d12d68a9ad816c09f7), [`a3a3624`](https://github.com/mastra-ai/mastra/commit/a3a3624f646b98e409424d8defccbd334da9e8b8), [`6246914`](https://github.com/mastra-ai/mastra/commit/62469146636911f3cbbe0880bd011c6a897a59a7), [`1315d8f`](https://github.com/mastra-ai/mastra/commit/1315d8f17e8e7acb61cca46b72a1d42f6d00d289), [`3f73c07`](https://github.com/mastra-ai/mastra/commit/3f73c076727e8c36b4fff7a1b40290fb68957fa8), [`7c1ebb1`](https://github.com/mastra-ai/mastra/commit/7c1ebb15690c4b3f0eabb19077cf8af573311e57), [`32980a3`](https://github.com/mastra-ai/mastra/commit/32980a3e2413d0274ac244d32c37d910edc13f00), [`261edb9`](https://github.com/mastra-ai/mastra/commit/261edb9bc0cfbed2b77090b87562307a360f1a04), [`4bcdfaf`](https://github.com/mastra-ai/mastra/commit/4bcdfaf0eac3199d7cb171b0a19a92c9c341eea4), [`1b1dd7b`](https://github.com/mastra-ai/mastra/commit/1b1dd7bc0e59b7a8bfabd09a3eec1ccd95b4c2f3), [`af4636a`](https://github.com/mastra-ai/mastra/commit/af4636a74463275d71c1d13a38f7d2b738f128bf), [`a463cdf`](https://github.com/mastra-ai/mastra/commit/a463cdf1c95c3059e70f0bff27959e8558bb899d), [`0ea6b80`](https://github.com/mastra-ai/mastra/commit/0ea6b8001408ce02b56e8be0536b0fd8cbaf8ad2)]:
  - @mastra/core@1.58.0-alpha.11
  - @mastra/github-signals@0.2.5-alpha.1
  - @mastra/memory@1.26.1-alpha.5
  - @mastra/mcp@1.16.0-alpha.2

## 1.2.0-alpha.11

### Patch Changes

- Updated dependencies [[`66bbfb5`](https://github.com/mastra-ai/mastra/commit/66bbfb5f05b473d39f88c0e4a481ccac41634f3a)]:
  - @mastra/core@1.58.0-alpha.10

## 1.2.0-alpha.10

### Patch Changes

- Include worktree identity (`worktree_path`, `branch`, `main_repo_path`) in `SessionStart` and `SessionEnd` hook payloads when a session runs in a git worktree, so hooks can provision and tear down per-worktree resources. ([#21034](https://github.com/mastra-ai/mastra/pull/21034))

- Updated dependencies [[`86b7b77`](https://github.com/mastra-ai/mastra/commit/86b7b777980d30f66e1fd134a37d2af4c22e54cc), [`80a3324`](https://github.com/mastra-ai/mastra/commit/80a33245d3110204de6f56d61211523ffe338692), [`d9d2881`](https://github.com/mastra-ai/mastra/commit/d9d2881ede6dd6c023d144215fc812062aed0890), [`82e3365`](https://github.com/mastra-ai/mastra/commit/82e3365ef7c9bf7bee2e7a7029035ea262d68895), [`1b482c2`](https://github.com/mastra-ai/mastra/commit/1b482c2d89244dd758c41e5f927a2b44041388d2), [`e6a2860`](https://github.com/mastra-ai/mastra/commit/e6a2860649cc51f87d32d78b766ae2126446ba07), [`7bd85ea`](https://github.com/mastra-ai/mastra/commit/7bd85ea7588b71c25ce9f4019c88f8539be5dcbc)]:
  - @mastra/core@1.58.0-alpha.9

## 1.2.0-alpha.9

### Patch Changes

- Updated dependencies [[`1c75e32`](https://github.com/mastra-ai/mastra/commit/1c75e32f7fc0b9fb6f548b4407feaec8a1440212), [`c47165c`](https://github.com/mastra-ai/mastra/commit/c47165c983c87594c6952f1fd2fa51a90205034c), [`e08e789`](https://github.com/mastra-ai/mastra/commit/e08e789c1bf4cd2fe46363f7a4728536ceccc9bd), [`35cc901`](https://github.com/mastra-ai/mastra/commit/35cc90102cf834a84827acaf9eee0b6d6d1e2a3b), [`a8b4cf0`](https://github.com/mastra-ai/mastra/commit/a8b4cf02823cffebc4751a53337dfacf097c1ae1), [`a53f19b`](https://github.com/mastra-ai/mastra/commit/a53f19b9badb8bd349fe2f885814e9db6b7d3c4b), [`f33264f`](https://github.com/mastra-ai/mastra/commit/f33264f517ae603279afd5c4251e2b40f6dd3618), [`689f2c4`](https://github.com/mastra-ai/mastra/commit/689f2c4b6c0835fe455702b01d21daa8abcd9331), [`eeae63e`](https://github.com/mastra-ai/mastra/commit/eeae63e7fbe8e1f237adc69bca6e2ac13c5ca907), [`4c186a0`](https://github.com/mastra-ai/mastra/commit/4c186a017275f45e6ed4c09de0f89550e2d09e8c), [`b0fa077`](https://github.com/mastra-ai/mastra/commit/b0fa077bcbc9b08551846fe372a0d3d15b71ed72)]:
  - @mastra/core@1.58.0-alpha.8
  - @mastra/memory@1.26.1-alpha.4
  - @mastra/libsql@1.20.0-alpha.2
  - @mastra/pg@1.20.0-alpha.3

## 1.2.0-alpha.8

### Patch Changes

- Updated dependencies [[`7fb580a`](https://github.com/mastra-ai/mastra/commit/7fb580ac73fbcacf2ff00872a3395f73ae1b9fa5), [`333785c`](https://github.com/mastra-ai/mastra/commit/333785c93cbb01e42c60167e995457c28897ddbf), [`2eabc09`](https://github.com/mastra-ai/mastra/commit/2eabc097d86d52fbd0123da36a7c874154cc384f), [`83fa004`](https://github.com/mastra-ai/mastra/commit/83fa0044bfda8b703a83883dbd8bef204844d13f)]:
  - @mastra/core@1.58.0-alpha.7

## 1.2.0-alpha.7

### Patch Changes

- Persist the browser viewport as a preset name, a `{ width, height }` size, or `'window'` in settings, and drop unusable stored values back to the default rather than passing them to the browser. ([#21010](https://github.com/mastra-ai/mastra/pull/21010))

- Fixed tenant credential resolution for session-based authentication providers. Background Factory runs now resolve the authenticated user and active organization from session-wrapped request context values instead of falling back to an empty credential store. ([#21008](https://github.com/mastra-ai/mastra/pull/21008))

- Updated dependencies [[`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`bf936e2`](https://github.com/mastra-ai/mastra/commit/bf936e2c89b2ff0dad5695b873ddc009ba96d41e)]:
  - @mastra/core@1.58.0-alpha.6
  - @mastra/agent-browser@0.5.1-alpha.0
  - @mastra/stagehand@0.3.2-alpha.1

## 1.2.0-alpha.6

### Patch Changes

- Added a `model` option to Stagehand browser settings, so browser automation can run on a chosen provider instead of a fixed default: ([#20993](https://github.com/mastra-ai/mastra/pull/20993))

  ```ts
  import { createBrowserFromSettings } from '@mastra/code-sdk/onboarding/settings';

  const browser = await createBrowserFromSettings({
    enabled: true,
    provider: 'stagehand',
    headless: true,
    stagehand: { env: 'LOCAL', model: 'anthropic/claude-sonnet-4-5' },
  });
  ```

  The model must be provider-qualified as `<provider>/<model>`. Values Stagehand cannot resolve, such as a bare `gpt-4.1`, are ignored so the browser still starts.

- Updated dependencies [[`25956fc`](https://github.com/mastra-ai/mastra/commit/25956fc8841780d506acb22b618fdb4dcf6c4e21)]:
  - @mastra/stagehand@0.3.2-alpha.0

## 1.2.0-alpha.5

### Patch Changes

- Updated dependencies [[`6445eba`](https://github.com/mastra-ai/mastra/commit/6445eba6020abac681aba1cc9289f446cb400cbe), [`deaf0c4`](https://github.com/mastra-ai/mastra/commit/deaf0c4c38fe2e988a094c63bbd8899436f4e579), [`df31eb0`](https://github.com/mastra-ai/mastra/commit/df31eb0c7087d782a0d9346e467f9a4af4b0eef6), [`59866f2`](https://github.com/mastra-ai/mastra/commit/59866f2e0a7986bea3b418aaa2c2f79a77d33719), [`fcd0667`](https://github.com/mastra-ai/mastra/commit/fcd0667a4e378be35c9a1b1eb19cce78fbfd7282), [`bab06b1`](https://github.com/mastra-ai/mastra/commit/bab06b18923873a584bdfc71a6b4ec7fb4727fb7)]:
  - @mastra/core@1.58.0-alpha.5
  - @mastra/memory@1.26.1-alpha.3
  - @mastra/libsql@1.20.0-alpha.1
  - @mastra/pg@1.20.0-alpha.2

## 1.2.0-alpha.4

### Patch Changes

- Updated dependencies [[`76e5132`](https://github.com/mastra-ai/mastra/commit/76e51328dbc0749c8304e6b3f21e4401f451b081), [`0282e16`](https://github.com/mastra-ai/mastra/commit/0282e16115538c8e9b248b90f0748eb01cb5dc98)]:
  - @mastra/core@1.58.0-alpha.4

## 1.2.0-alpha.3

### Minor Changes

- Add a reasoning-effort configuration surface across mastracode and Factory (fixes #20766): ([#20884](https://github.com/mastra-ai/mastra/pull/20884))

  - New `max` thinking level (mapped to `reasoning effort: max` for OpenAI Codex and Anthropic `effort`).
  - Anthropic extended-thinking wiring: the session thinking level now applies to anthropic/claude-opus-4-7 and other Anthropic models via provider thinking/effort options (previously OpenAI-only).
  - New `models.modeThinkingDefaults` setting: per-mode (build/plan/fast) default thinking levels, resolved at request time with precedence session override → mode default → global `preferences.thinkingLevel`. Configuration changes now apply to the next request of every session, including automated Factory runs.
  - Factory: new Settings → Defaults controls for editing global and per-mode thinking defaults in local deployments.
  - TUI: `/think` now sets a session-only override, supports `/think default` to clear it, and `/think status` reports the effective level with provenance (session override / mode default / global default).

  Example `settings.json` configuration:

  ```json
  {
    "preferences": { "thinkingLevel": "medium" },
    "models": {
      "modeThinkingDefaults": {
        "build": "high",
        "plan": "max",
        "fast": "off"
      }
    }
  }
  ```

### Patch Changes

- Updated dependencies [[`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`6bff877`](https://github.com/mastra-ai/mastra/commit/6bff877e214695ff8d9c84b06c13a6e6bcf9f1ed), [`d7cf7fa`](https://github.com/mastra-ai/mastra/commit/d7cf7fafc1ae1b50bd8462dd0e6c671a8606db93), [`0f9a448`](https://github.com/mastra-ai/mastra/commit/0f9a448502157e59f7b76f24360ad497168f5ef8), [`289f4ce`](https://github.com/mastra-ai/mastra/commit/289f4ce16e3293370440172132c52ee787cbc09f), [`4f16ff8`](https://github.com/mastra-ai/mastra/commit/4f16ff824bf2f9b0ddc93f210477c10c8a4fb1ab), [`1c67d85`](https://github.com/mastra-ai/mastra/commit/1c67d85e9da8285662f4dbbf47e0378c3fee0747), [`03ebe06`](https://github.com/mastra-ai/mastra/commit/03ebe06aeb671d7127b700e53853ed0759e4c19f), [`ba24be6`](https://github.com/mastra-ai/mastra/commit/ba24be662439c331ab23a600041f93803c89eca8), [`842b5fe`](https://github.com/mastra-ai/mastra/commit/842b5fe22b6a7fa811bd14e48eb9af523ac989f2), [`80bdf3a`](https://github.com/mastra-ai/mastra/commit/80bdf3ae16ade6ff63bde0cb16fa2df8ab7dd4dd), [`195e83c`](https://github.com/mastra-ai/mastra/commit/195e83c077687f6016fd8090324975c8d8cea50b), [`9ba1247`](https://github.com/mastra-ai/mastra/commit/9ba12470c77f1c03642d720ce67e517e878f666e), [`fd96298`](https://github.com/mastra-ai/mastra/commit/fd96298a8367622f4ebfcaa97b5b6c1fbbd14564), [`9168b80`](https://github.com/mastra-ai/mastra/commit/9168b80120a82816b1b9f2385e788bf86fa5d9cd), [`6a84954`](https://github.com/mastra-ai/mastra/commit/6a84954a2667f85b6d59da652dab1bbff007ccb0), [`52d8ef0`](https://github.com/mastra-ai/mastra/commit/52d8ef03801f1deb7ee48532fc4190dd4a33916c), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`289f4ce`](https://github.com/mastra-ai/mastra/commit/289f4ce16e3293370440172132c52ee787cbc09f), [`edfe906`](https://github.com/mastra-ai/mastra/commit/edfe906f7926faf8c63c21b3c87e797985557feb), [`efd5c81`](https://github.com/mastra-ai/mastra/commit/efd5c81cc25fde3c2ddd86fc1178deb4ec176e19), [`43ea2a1`](https://github.com/mastra-ai/mastra/commit/43ea2a1f5c5867d0f41254047a786e96cd00798b), [`0976933`](https://github.com/mastra-ai/mastra/commit/0976933142333ec78451feef265b68bcb45aa5e7), [`242b945`](https://github.com/mastra-ai/mastra/commit/242b94558777bfbdeb42cbfea84afff0b6ad0633), [`fea5cae`](https://github.com/mastra-ai/mastra/commit/fea5caedc7e2cfea51784a15e015952692027abf), [`4b59f78`](https://github.com/mastra-ai/mastra/commit/4b59f786cbc9a7d1ef07a07517dbd4b96865e99d), [`9ba1247`](https://github.com/mastra-ai/mastra/commit/9ba12470c77f1c03642d720ce67e517e878f666e), [`7010c5d`](https://github.com/mastra-ai/mastra/commit/7010c5d15728bf9c5dfe4fb6b1bf80ce23bf143a)]:
  - @mastra/core@1.58.0-alpha.3
  - @mastra/observability@1.16.6-alpha.2
  - @mastra/schema-compat@1.3.6-alpha.2
  - @mastra/pg@1.20.0-alpha.1
  - @mastra/memory@1.26.1-alpha.2
  - @mastra/github-signals@0.2.5-alpha.0
  - @mastra/mcp@1.16.0-alpha.1

## 1.2.0-alpha.2

### Patch Changes

- Updated dependencies [[`1bdfde1`](https://github.com/mastra-ai/mastra/commit/1bdfde1f4061b7c0550253a1512a2118debe7996), [`b4c89b4`](https://github.com/mastra-ai/mastra/commit/b4c89b4371b0c86da57403ad1a3b3ef0681f3128), [`e44e8f3`](https://github.com/mastra-ai/mastra/commit/e44e8f370b66c339ddcaba946d33da6d3c3f06cd), [`c967a5e`](https://github.com/mastra-ai/mastra/commit/c967a5eec150c5dc5418c4a4388982d1fb7ad27c), [`f53d5bd`](https://github.com/mastra-ai/mastra/commit/f53d5bd4885b29e4ac29a428a6044088ea8d6aa3), [`bda2235`](https://github.com/mastra-ai/mastra/commit/bda22353ee28f2df0eaea555f7cae1549f979c0b), [`a7eb4a1`](https://github.com/mastra-ai/mastra/commit/a7eb4a11450f6170274ed5141bffe821d4fdd5a6), [`2f9ef3f`](https://github.com/mastra-ai/mastra/commit/2f9ef3f4ca06fc2dcdd5088c26b7f4da6a016791), [`e7eefcb`](https://github.com/mastra-ai/mastra/commit/e7eefcb162cda7c493e8c3bf43050ead0efbcb2c), [`4d7aca2`](https://github.com/mastra-ai/mastra/commit/4d7aca2fe75f225c83d1502d63079568e6ec163f), [`c4ec889`](https://github.com/mastra-ai/mastra/commit/c4ec889561c0264c43f66d04d587bee4ce35e792), [`9be8878`](https://github.com/mastra-ai/mastra/commit/9be8878dcf0388e84fc4873e0eec27bd49b881a4)]:
  - @mastra/observability@1.16.6-alpha.1
  - @mastra/core@1.58.0-alpha.2
  - @mastra/schema-compat@1.3.6-alpha.1
  - @mastra/mcp@1.16.0-alpha.0
  - @mastra/memory@1.26.1-alpha.1

## 1.2.0-alpha.1

### Minor Changes

- Added MCP disable-state controls to the MCP manager. Servers can be disabled for the current project or for every project, the state persists across runs in an app-data `mcp-state.json` (user MCP config files are never mutated), and disabled servers stay visible in statuses via the new `disabled`/`disabledScope` fields on `McpServerStatus`. ([#20834](https://github.com/mastra-ai/mastra/pull/20834))

  ```ts
  await mcpManager.setServerDisabled('filesystem', true); // project scope
  await mcpManager.setServerDisabled('filesystem', true, { global: true }); // all projects
  await mcpManager.setAllDisabled(true, { global: true }); // global kill switch
  mcpManager.isAllDisabledGlobally();
  mcpManager.getDisabledServers();
  ```

### Patch Changes

- dependencies updates: ([#19783](https://github.com/mastra-ai/mastra/pull/19783))
  - Updated dependency [`posthog-node@^5.46.1` ↗︎](https://www.npmjs.com/package/posthog-node/v/5.46.1) (from `^5.37.0`, in `dependencies`)

- dependencies updates: ([#20406](https://github.com/mastra-ai/mastra/pull/20406))
  - Updated dependency [`@aws-sdk/credential-providers@^3.1095.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/credential-providers/v/3.1095.0) (from `^3.864.0`, in `dependencies`)

- Fixed custom provider models saved with a stray `mastracode/` prefix in settings, which broke selecting and using them after choosing them from `/models` (#20799) ([#20804](https://github.com/mastra-ai/mastra/pull/20804))

- Updated dependencies [[`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`f5a17d9`](https://github.com/mastra-ai/mastra/commit/f5a17d95c19e7d4149996932bd8d1905089f031d), [`578bf2e`](https://github.com/mastra-ai/mastra/commit/578bf2e6a88e9d5b8bf502204e15a95dfbb679ae), [`06b2d87`](https://github.com/mastra-ai/mastra/commit/06b2d87e63bcdd0ed59215c6789692b9b12de376), [`ac01d63`](https://github.com/mastra-ai/mastra/commit/ac01d6355974aec73fdb8781449ed12bac582094), [`8627c23`](https://github.com/mastra-ai/mastra/commit/8627c23d794485fb97d533fc2a7a8323bfec2225), [`a810a05`](https://github.com/mastra-ai/mastra/commit/a810a058f62ad407cfc1701e0be36ae91145d7cf), [`26ff3b9`](https://github.com/mastra-ai/mastra/commit/26ff3b9144132bd8570e4796d436fb57a9a2bf24), [`3ff2be3`](https://github.com/mastra-ai/mastra/commit/3ff2be3a5a579d2e2d7084ba0624ec24faadce4d), [`f8da216`](https://github.com/mastra-ai/mastra/commit/f8da21633e7eb0e31c9ce0fc30567870d19416d3), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`c71e307`](https://github.com/mastra-ai/mastra/commit/c71e3077e69eae3f25aa628e3778f153a9d6ab36), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`a4f6806`](https://github.com/mastra-ai/mastra/commit/a4f68065d082af57770e7ee3d34996fdc914dbd1), [`6104347`](https://github.com/mastra-ai/mastra/commit/61043473ba6bfd0a25156824e853e13165562e6c), [`ffdfa25`](https://github.com/mastra-ai/mastra/commit/ffdfa25b5cdf3ecfd0c5a2e96363c3ba50995ce9), [`45bfb88`](https://github.com/mastra-ai/mastra/commit/45bfb88fd52f1dd3be20e2a38905777c96499c90), [`e3b9307`](https://github.com/mastra-ai/mastra/commit/e3b9307098daefbfae2a52ae2ef51bc9fc701190), [`d6834c5`](https://github.com/mastra-ai/mastra/commit/d6834c5a7866b16734d23900163c2414ed70d791), [`c52d346`](https://github.com/mastra-ai/mastra/commit/c52d3462ec831a5d95926ecd3d3373f5928ad2e5), [`0023e79`](https://github.com/mastra-ai/mastra/commit/0023e7919431078280abd11c89d1edeae35fcc69), [`c2ad51e`](https://github.com/mastra-ai/mastra/commit/c2ad51e2467f901eecba8c9f4a45e22a50bd7c18), [`3dc97ea`](https://github.com/mastra-ai/mastra/commit/3dc97ea415fad353b48a13095fad1835933cc12a), [`3d01cd3`](https://github.com/mastra-ai/mastra/commit/3d01cd387321b6f9c5cac31d487c84bf51b19c78), [`7bf3086`](https://github.com/mastra-ai/mastra/commit/7bf308663f0115ca74ad20554ade740f06640859), [`a8dd139`](https://github.com/mastra-ai/mastra/commit/a8dd1391a9fe9a6632c25809ef236980afa9a020), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`d6c63e4`](https://github.com/mastra-ai/mastra/commit/d6c63e4b757babb95a735d0e421d4dac67c1dcf1), [`2093fbd`](https://github.com/mastra-ai/mastra/commit/2093fbd53bb744bae19ec89f6d73db9a66fbe8a7), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`e4d3761`](https://github.com/mastra-ai/mastra/commit/e4d376143cf3322885a7e6e4048e536ce441f785), [`7b4393d`](https://github.com/mastra-ai/mastra/commit/7b4393d557411fdcf07b0e30e5acaf7cc85154ae)]:
  - @mastra/core@1.58.0-alpha.1
  - @mastra/libsql@1.20.0-alpha.0
  - @mastra/pg@1.20.0-alpha.0
  - @mastra/schema-compat@1.3.6-alpha.0
  - @mastra/observability@1.16.6-alpha.0
  - @mastra/mcp@1.16.0-alpha.0
  - @mastra/memory@1.26.1-alpha.0
  - @mastra/duckdb@1.6.1-alpha.0

## 1.1.4-alpha.0

### Patch Changes

- Updated dependencies [[`45a9147`](https://github.com/mastra-ai/mastra/commit/45a914741f578754d79d8b7de7b4e4f304d8e14a), [`990611b`](https://github.com/mastra-ai/mastra/commit/990611ba76eb876d86c9c594371ae5f02f94b432), [`ed5d606`](https://github.com/mastra-ai/mastra/commit/ed5d606739c5e3fbdfa9f272df7809aa5ab43b1d)]:
  - @mastra/core@1.58.0-alpha.0

## 1.1.3

### Patch Changes

- dependencies updates: ([#20149](https://github.com/mastra-ai/mastra/pull/20149))
  - Updated dependency [`@ai-sdk/amazon-bedrock@^3.0.111` ↗︎](https://www.npmjs.com/package/@ai-sdk/amazon-bedrock/v/3.0.111) (from `^3.0.107`, in `dependencies`)
  - Updated dependency [`@ai-sdk/anthropic@^3.0.103` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/3.0.103) (from `^3.0.98`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai@^3.0.88` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai/v/3.0.88) (from `^3.0.86`, in `dependencies`)
  - Updated dependency [`ai@^6.0.236` ↗︎](https://www.npmjs.com/package/ai/v/6.0.236) (from `^6.0.230`, in `dependencies`)
- Updated dependencies [[`8d2399b`](https://github.com/mastra-ai/mastra/commit/8d2399b638f8e0945cf2cda0187dbea8dcf0b784), [`cd1f0cc`](https://github.com/mastra-ai/mastra/commit/cd1f0cc071ac440f4fae15589362cd2cb00aff57), [`c8002da`](https://github.com/mastra-ai/mastra/commit/c8002da7775c468e2965b6ff5f82045450fa8cb9), [`92be47f`](https://github.com/mastra-ai/mastra/commit/92be47fbd26ffccec0e2131ef7c1d9e70dd5ef4a), [`89200ba`](https://github.com/mastra-ai/mastra/commit/89200bafa05444bb7949b363ce7b743e29867561), [`3d6ae10`](https://github.com/mastra-ai/mastra/commit/3d6ae107c009a40cef08e83da6866c20783d7ac1), [`c950138`](https://github.com/mastra-ai/mastra/commit/c950138e72e4f317a40187e3800588731ab790ce), [`810c7e7`](https://github.com/mastra-ai/mastra/commit/810c7e74929989d8b8b5db52cd3af22cd0998af4), [`063c8b2`](https://github.com/mastra-ai/mastra/commit/063c8b2eb14e4e5ca021779bc33e8c3c031c8604), [`f9f9884`](https://github.com/mastra-ai/mastra/commit/f9f98848ee194dc71a787a709ec430b065cdc41b), [`e0904dc`](https://github.com/mastra-ai/mastra/commit/e0904dc538792e54e1806b70172e5900ac49bff4), [`9672fab`](https://github.com/mastra-ai/mastra/commit/9672fabfbcadb961a35c22a2d6722e077f7b24b9), [`f4e964c`](https://github.com/mastra-ai/mastra/commit/f4e964cad57057301d6bed5c55bcdd730175b941), [`1f7bbd7`](https://github.com/mastra-ai/mastra/commit/1f7bbd7785a8d230aad02454ecabeb4a0b2cc96f), [`e47ff36`](https://github.com/mastra-ai/mastra/commit/e47ff36945720f4ee4caa09f6e83514d7d188608), [`64d6781`](https://github.com/mastra-ai/mastra/commit/64d67814bccddd314f7e09643243821e57cb87b6), [`14562d6`](https://github.com/mastra-ai/mastra/commit/14562d6ea724ed4ccb9fb079d016ec7ab1bd92a4), [`fb9a6ac`](https://github.com/mastra-ai/mastra/commit/fb9a6ac11c9560518742ece60b49d6b062845fd3), [`aa2cec8`](https://github.com/mastra-ai/mastra/commit/aa2cec8501f634d51c2f3ebfb3dd3aa7af8d2ca2), [`c848e65`](https://github.com/mastra-ai/mastra/commit/c848e655a64ff10331a8ceafafe7f18e70a0f092), [`2adf8eb`](https://github.com/mastra-ai/mastra/commit/2adf8eb4a70ed2b6cff2dd39281496ea0e025fac), [`0494489`](https://github.com/mastra-ai/mastra/commit/049448906e4c3d2d615bbe865b073a0d890ddb7c), [`8d1aeb8`](https://github.com/mastra-ai/mastra/commit/8d1aeb8acf7c20c4bb8e4d8e4bdc6569c83ac561), [`9672fab`](https://github.com/mastra-ai/mastra/commit/9672fabfbcadb961a35c22a2d6722e077f7b24b9), [`0c1b840`](https://github.com/mastra-ai/mastra/commit/0c1b8405fd1bd464199755bc3f93bd7e3c18e9ad), [`8264611`](https://github.com/mastra-ai/mastra/commit/8264611510e421b818bc7395dc2ae4d9c2d518b2), [`1680d6b`](https://github.com/mastra-ai/mastra/commit/1680d6bb0f45f0a0cb10068acb61ec7a27eec8c2), [`d8fa243`](https://github.com/mastra-ai/mastra/commit/d8fa2430d21113e330c4e676ac65e1235cf44f81), [`71b8b62`](https://github.com/mastra-ai/mastra/commit/71b8b62084bf11d8006145129b720843f7f04bd9), [`44fc98b`](https://github.com/mastra-ai/mastra/commit/44fc98b9d1242aa87a3ab44bdce9e9f12c44d8c9), [`f933ba3`](https://github.com/mastra-ai/mastra/commit/f933ba32700e1d0bf143311c1a08f88300b840b6), [`83065bf`](https://github.com/mastra-ai/mastra/commit/83065bfee9e47c3c6f09132a9034501f6cfb69cf), [`0f2ef41`](https://github.com/mastra-ai/mastra/commit/0f2ef4118da022e4f30dac4e9856cc3a8c97671c), [`01b162f`](https://github.com/mastra-ai/mastra/commit/01b162fe435295881aa7ea55f1759407ad5175ad)]:
  - @mastra/core@1.57.0
  - @mastra/agent-browser@0.5.0
  - @mastra/observability@1.16.5
  - @mastra/schema-compat@1.3.5
  - @mastra/memory@1.26.0
  - @mastra/github-signals@0.2.4
  - @mastra/mcp@1.15.1

## 1.1.3-alpha.2

### Patch Changes

- Updated dependencies [[`810c7e7`](https://github.com/mastra-ai/mastra/commit/810c7e74929989d8b8b5db52cd3af22cd0998af4), [`f9f9884`](https://github.com/mastra-ai/mastra/commit/f9f98848ee194dc71a787a709ec430b065cdc41b), [`e0904dc`](https://github.com/mastra-ai/mastra/commit/e0904dc538792e54e1806b70172e5900ac49bff4), [`64d6781`](https://github.com/mastra-ai/mastra/commit/64d67814bccddd314f7e09643243821e57cb87b6), [`c848e65`](https://github.com/mastra-ai/mastra/commit/c848e655a64ff10331a8ceafafe7f18e70a0f092), [`0494489`](https://github.com/mastra-ai/mastra/commit/049448906e4c3d2d615bbe865b073a0d890ddb7c), [`8d1aeb8`](https://github.com/mastra-ai/mastra/commit/8d1aeb8acf7c20c4bb8e4d8e4bdc6569c83ac561), [`83065bf`](https://github.com/mastra-ai/mastra/commit/83065bfee9e47c3c6f09132a9034501f6cfb69cf), [`01b162f`](https://github.com/mastra-ai/mastra/commit/01b162fe435295881aa7ea55f1759407ad5175ad)]:
  - @mastra/core@1.57.0-alpha.2

## 1.1.3-alpha.1

### Patch Changes

- Updated dependencies [[`cd1f0cc`](https://github.com/mastra-ai/mastra/commit/cd1f0cc071ac440f4fae15589362cd2cb00aff57), [`89200ba`](https://github.com/mastra-ai/mastra/commit/89200bafa05444bb7949b363ce7b743e29867561), [`c950138`](https://github.com/mastra-ai/mastra/commit/c950138e72e4f317a40187e3800588731ab790ce), [`063c8b2`](https://github.com/mastra-ai/mastra/commit/063c8b2eb14e4e5ca021779bc33e8c3c031c8604), [`f4e964c`](https://github.com/mastra-ai/mastra/commit/f4e964cad57057301d6bed5c55bcdd730175b941), [`1f7bbd7`](https://github.com/mastra-ai/mastra/commit/1f7bbd7785a8d230aad02454ecabeb4a0b2cc96f), [`e47ff36`](https://github.com/mastra-ai/mastra/commit/e47ff36945720f4ee4caa09f6e83514d7d188608), [`14562d6`](https://github.com/mastra-ai/mastra/commit/14562d6ea724ed4ccb9fb079d016ec7ab1bd92a4), [`fb9a6ac`](https://github.com/mastra-ai/mastra/commit/fb9a6ac11c9560518742ece60b49d6b062845fd3), [`aa2cec8`](https://github.com/mastra-ai/mastra/commit/aa2cec8501f634d51c2f3ebfb3dd3aa7af8d2ca2), [`2adf8eb`](https://github.com/mastra-ai/mastra/commit/2adf8eb4a70ed2b6cff2dd39281496ea0e025fac), [`8264611`](https://github.com/mastra-ai/mastra/commit/8264611510e421b818bc7395dc2ae4d9c2d518b2), [`1680d6b`](https://github.com/mastra-ai/mastra/commit/1680d6bb0f45f0a0cb10068acb61ec7a27eec8c2), [`44fc98b`](https://github.com/mastra-ai/mastra/commit/44fc98b9d1242aa87a3ab44bdce9e9f12c44d8c9), [`0f2ef41`](https://github.com/mastra-ai/mastra/commit/0f2ef4118da022e4f30dac4e9856cc3a8c97671c)]:
  - @mastra/agent-browser@0.5.0-alpha.0
  - @mastra/core@1.57.0-alpha.1
  - @mastra/schema-compat@1.3.5-alpha.0
  - @mastra/memory@1.25.1-alpha.0
  - @mastra/mcp@1.15.1

## 1.1.3-alpha.0

### Patch Changes

- Updated dependencies [[`c8002da`](https://github.com/mastra-ai/mastra/commit/c8002da7775c468e2965b6ff5f82045450fa8cb9)]:
  - @mastra/core@1.56.1-alpha.0

## 1.1.2

### Patch Changes

- Added `skipGlobalInstructions` to session state. When set, a session ignores the agent instruction files in the machine's home directory (`~/.claude/CLAUDE.md`, `~/.mastracode/AGENTS.md`, and the other supported locations) and reads only the ones in the project it works on. Servers that run sessions on behalf of other people set it so a run never inherits the personal configuration of whoever hosts the process. ([#20633](https://github.com/mastra-ai/mastra/pull/20633))

  Seed it on the controller to cover every session it creates:

  ```ts
  prepareAgentControllerMount({
    initialState: { skipGlobalInstructions: true },
  });
  ```

  Sessions you drive yourself are unaffected and still read your home directory instructions.

- Updated dependencies [[`4844167`](https://github.com/mastra-ai/mastra/commit/4844167cff2d5ec5004e94edd34970833040fa3f), [`c5e56ff`](https://github.com/mastra-ai/mastra/commit/c5e56ff3bcabdf062708f2d48744fec304df6792), [`594f7b2`](https://github.com/mastra-ai/mastra/commit/594f7b28f5263fb9982fd50d95c471fb971ea984), [`7f4e26d`](https://github.com/mastra-ai/mastra/commit/7f4e26dd57bd9b23c278ea21235ab823a3810a6c), [`311f943`](https://github.com/mastra-ai/mastra/commit/311f943bee60e8fdf5c84499ea50e884276c936c), [`c5e56ff`](https://github.com/mastra-ai/mastra/commit/c5e56ff3bcabdf062708f2d48744fec304df6792), [`5cbfdaa`](https://github.com/mastra-ai/mastra/commit/5cbfdaae759adb1ca9d95cfd853edd775c1c9ef8), [`322daa6`](https://github.com/mastra-ai/mastra/commit/322daa6d90552909204044790d850958f6745fed), [`a19e5b7`](https://github.com/mastra-ai/mastra/commit/a19e5b79b76fffa92f9cf17e0e89c3fa714534e8), [`db4e6ff`](https://github.com/mastra-ai/mastra/commit/db4e6ff744503112eb64deeaf6c2b54bf26a54c7), [`5faf93f`](https://github.com/mastra-ai/mastra/commit/5faf93f03e19daea394b9e2a923f2e4f833407f2), [`82201f7`](https://github.com/mastra-ai/mastra/commit/82201f75fae8e050a8de2df08b74875ee74c6b83), [`2c34a58`](https://github.com/mastra-ai/mastra/commit/2c34a58aff529d7f42f883b2c7f3e7d6745fc224), [`cadaa13`](https://github.com/mastra-ai/mastra/commit/cadaa1372e1077c8e85eb64c5499ba8803caa323), [`0c89896`](https://github.com/mastra-ai/mastra/commit/0c8989673fb7d106837098398131e570c6023b68), [`6d19a65`](https://github.com/mastra-ai/mastra/commit/6d19a6517f5da3911023d446b7e2d5dad8adb1cb), [`23b4238`](https://github.com/mastra-ai/mastra/commit/23b423844ad0bcf2a502a68dd62866d6160f9f6d), [`80ad891`](https://github.com/mastra-ai/mastra/commit/80ad891f8cd10379aa5b5af7510c763783b2ab56), [`19ccefa`](https://github.com/mastra-ai/mastra/commit/19ccefa628dc971b4bfa2058a324a6ac9b846358), [`19ccefa`](https://github.com/mastra-ai/mastra/commit/19ccefa628dc971b4bfa2058a324a6ac9b846358), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`e320a76`](https://github.com/mastra-ai/mastra/commit/e320a763feaf65c6be3cebecf746defcbde161b3), [`03b4918`](https://github.com/mastra-ai/mastra/commit/03b4918c80d188ce375334c393e131c6e94bd7eb), [`14ef73a`](https://github.com/mastra-ai/mastra/commit/14ef73a4bbd73e7808414816eb0628ce1d80b5d7), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c), [`0a6598b`](https://github.com/mastra-ai/mastra/commit/0a6598bde80bde008986ad6616bed9632b9294cb), [`06000d7`](https://github.com/mastra-ai/mastra/commit/06000d73712911572e913b8a83339270296d0a22), [`1d677d5`](https://github.com/mastra-ai/mastra/commit/1d677d5f99d7db403f7828585e8c25f299f72628), [`c6bfd8e`](https://github.com/mastra-ai/mastra/commit/c6bfd8eb6a10e0fb137893aac87c67ce8ac23b12), [`c78aa4e`](https://github.com/mastra-ai/mastra/commit/c78aa4ecc422ba70476da73709c3e7d85edc71d6), [`9e1dad8`](https://github.com/mastra-ai/mastra/commit/9e1dad8f7b1cab2bb7ade90e5b7561f24577b88a), [`2f43145`](https://github.com/mastra-ai/mastra/commit/2f4314504c03cbba280414ac81ba3197448ee6b0), [`0c89896`](https://github.com/mastra-ai/mastra/commit/0c8989673fb7d106837098398131e570c6023b68), [`4e35a56`](https://github.com/mastra-ai/mastra/commit/4e35a56cdf8d74a5ff6d5eda01f2c1deaf6cc7be), [`bc3b722`](https://github.com/mastra-ai/mastra/commit/bc3b72225921ebcb05704c3fdf051d69b2f8c3ae), [`481d2c7`](https://github.com/mastra-ai/mastra/commit/481d2c7bc37a5ba1153bd1da8d18a06f0ccd9d16), [`d94b8e1`](https://github.com/mastra-ai/mastra/commit/d94b8e1cee67416d518a8c30099040061bef6a1c), [`93e28ec`](https://github.com/mastra-ai/mastra/commit/93e28ecce9031c02397e0ae8406593e5c7a95883), [`729dab4`](https://github.com/mastra-ai/mastra/commit/729dab408faccfaef0cbb048e5a4338f9172847e), [`4e35a56`](https://github.com/mastra-ai/mastra/commit/4e35a56cdf8d74a5ff6d5eda01f2c1deaf6cc7be), [`484003d`](https://github.com/mastra-ai/mastra/commit/484003d33ff59330c86b19863e4a38732d7e4155), [`3de0188`](https://github.com/mastra-ai/mastra/commit/3de0188bfaf9a9c09c95fe322b53838cf52c70b6), [`9fbd007`](https://github.com/mastra-ai/mastra/commit/9fbd0077b31a28054b16e1467f1b577e8ed62be4), [`5faf93f`](https://github.com/mastra-ai/mastra/commit/5faf93f03e19daea394b9e2a923f2e4f833407f2), [`34d34d8`](https://github.com/mastra-ai/mastra/commit/34d34d8c811df512fef4dd5459f79b7821be1866), [`f6e002c`](https://github.com/mastra-ai/mastra/commit/f6e002c9e15eda94fcb35c350c60f9bba1b823d4), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c), [`5faf93f`](https://github.com/mastra-ai/mastra/commit/5faf93f03e19daea394b9e2a923f2e4f833407f2), [`933d291`](https://github.com/mastra-ai/mastra/commit/933d291146b789c19442ad206f94da3e4be90c64), [`a1cb98d`](https://github.com/mastra-ai/mastra/commit/a1cb98d11990b560b98482292a1f34aa1a2d9092), [`598ad82`](https://github.com/mastra-ai/mastra/commit/598ad82d41c41389a686338a1d0e50b7400e1938), [`1fd6aad`](https://github.com/mastra-ai/mastra/commit/1fd6aad1ea4a9d32f65efa832307c35e981a4c0a), [`34d34d8`](https://github.com/mastra-ai/mastra/commit/34d34d8c811df512fef4dd5459f79b7821be1866)]:
  - @mastra/core@1.56.0
  - @mastra/pg@1.19.0
  - @mastra/libsql@1.19.0
  - @mastra/github-signals@0.2.3
  - @mastra/mcp@1.15.1
  - @mastra/observability@1.16.4
  - @mastra/duckdb@1.6.0
  - @mastra/memory@1.25.0

## 1.1.2-alpha.7

### Patch Changes

- Updated dependencies [[`d94b8e1`](https://github.com/mastra-ai/mastra/commit/d94b8e1cee67416d518a8c30099040061bef6a1c)]:
  - @mastra/core@1.56.0-alpha.7

## 1.1.2-alpha.6

### Patch Changes

- Added `skipGlobalInstructions` to session state. When set, a session ignores the agent instruction files in the machine's home directory (`~/.claude/CLAUDE.md`, `~/.mastracode/AGENTS.md`, and the other supported locations) and reads only the ones in the project it works on. Servers that run sessions on behalf of other people set it so a run never inherits the personal configuration of whoever hosts the process. ([#20633](https://github.com/mastra-ai/mastra/pull/20633))

  Seed it on the controller to cover every session it creates:

  ```ts
  prepareAgentControllerMount({
    initialState: { skipGlobalInstructions: true },
  });
  ```

  Sessions you drive yourself are unaffected and still read your home directory instructions.

- Updated dependencies [[`a19e5b7`](https://github.com/mastra-ai/mastra/commit/a19e5b79b76fffa92f9cf17e0e89c3fa714534e8), [`82201f7`](https://github.com/mastra-ai/mastra/commit/82201f75fae8e050a8de2df08b74875ee74c6b83), [`19ccefa`](https://github.com/mastra-ai/mastra/commit/19ccefa628dc971b4bfa2058a324a6ac9b846358), [`19ccefa`](https://github.com/mastra-ai/mastra/commit/19ccefa628dc971b4bfa2058a324a6ac9b846358), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`0a6598b`](https://github.com/mastra-ai/mastra/commit/0a6598bde80bde008986ad6616bed9632b9294cb), [`9e1dad8`](https://github.com/mastra-ai/mastra/commit/9e1dad8f7b1cab2bb7ade90e5b7561f24577b88a), [`2f43145`](https://github.com/mastra-ai/mastra/commit/2f4314504c03cbba280414ac81ba3197448ee6b0), [`34d34d8`](https://github.com/mastra-ai/mastra/commit/34d34d8c811df512fef4dd5459f79b7821be1866), [`f6e002c`](https://github.com/mastra-ai/mastra/commit/f6e002c9e15eda94fcb35c350c60f9bba1b823d4), [`34d34d8`](https://github.com/mastra-ai/mastra/commit/34d34d8c811df512fef4dd5459f79b7821be1866)]:
  - @mastra/mcp@1.15.1-alpha.1
  - @mastra/core@1.56.0-alpha.6
  - @mastra/pg@1.19.0-alpha.3
  - @mastra/libsql@1.19.0-alpha.2
  - @mastra/duckdb@1.6.0-alpha.0
  - @mastra/memory@1.25.0-alpha.2

## 1.1.2-alpha.5

### Patch Changes

- Updated dependencies [[`db4e6ff`](https://github.com/mastra-ai/mastra/commit/db4e6ff744503112eb64deeaf6c2b54bf26a54c7), [`6d19a65`](https://github.com/mastra-ai/mastra/commit/6d19a6517f5da3911023d446b7e2d5dad8adb1cb)]:
  - @mastra/core@1.56.0-alpha.5

## 1.1.2-alpha.4

### Patch Changes

- Updated dependencies [[`4844167`](https://github.com/mastra-ai/mastra/commit/4844167cff2d5ec5004e94edd34970833040fa3f), [`5faf93f`](https://github.com/mastra-ai/mastra/commit/5faf93f03e19daea394b9e2a923f2e4f833407f2), [`80ad891`](https://github.com/mastra-ai/mastra/commit/80ad891f8cd10379aa5b5af7510c763783b2ab56), [`c78aa4e`](https://github.com/mastra-ai/mastra/commit/c78aa4ecc422ba70476da73709c3e7d85edc71d6), [`481d2c7`](https://github.com/mastra-ai/mastra/commit/481d2c7bc37a5ba1153bd1da8d18a06f0ccd9d16), [`9fbd007`](https://github.com/mastra-ai/mastra/commit/9fbd0077b31a28054b16e1467f1b577e8ed62be4), [`5faf93f`](https://github.com/mastra-ai/mastra/commit/5faf93f03e19daea394b9e2a923f2e4f833407f2), [`5faf93f`](https://github.com/mastra-ai/mastra/commit/5faf93f03e19daea394b9e2a923f2e4f833407f2), [`a1cb98d`](https://github.com/mastra-ai/mastra/commit/a1cb98d11990b560b98482292a1f34aa1a2d9092), [`598ad82`](https://github.com/mastra-ai/mastra/commit/598ad82d41c41389a686338a1d0e50b7400e1938), [`1fd6aad`](https://github.com/mastra-ai/mastra/commit/1fd6aad1ea4a9d32f65efa832307c35e981a4c0a)]:
  - @mastra/core@1.56.0-alpha.4
  - @mastra/mcp@1.15.1-alpha.0
  - @mastra/memory@1.25.0-alpha.1
  - @mastra/observability@1.16.4-alpha.2
  - @mastra/pg@1.19.0-alpha.2
  - @mastra/libsql@1.19.0-alpha.1

## 1.1.2-alpha.3

### Patch Changes

- Updated dependencies [[`594f7b2`](https://github.com/mastra-ai/mastra/commit/594f7b28f5263fb9982fd50d95c471fb971ea984), [`311f943`](https://github.com/mastra-ai/mastra/commit/311f943bee60e8fdf5c84499ea50e884276c936c), [`5cbfdaa`](https://github.com/mastra-ai/mastra/commit/5cbfdaae759adb1ca9d95cfd853edd775c1c9ef8), [`0c89896`](https://github.com/mastra-ai/mastra/commit/0c8989673fb7d106837098398131e570c6023b68), [`23b4238`](https://github.com/mastra-ai/mastra/commit/23b423844ad0bcf2a502a68dd62866d6160f9f6d), [`e320a76`](https://github.com/mastra-ai/mastra/commit/e320a763feaf65c6be3cebecf746defcbde161b3), [`03b4918`](https://github.com/mastra-ai/mastra/commit/03b4918c80d188ce375334c393e131c6e94bd7eb), [`14ef73a`](https://github.com/mastra-ai/mastra/commit/14ef73a4bbd73e7808414816eb0628ce1d80b5d7), [`1d677d5`](https://github.com/mastra-ai/mastra/commit/1d677d5f99d7db403f7828585e8c25f299f72628), [`c6bfd8e`](https://github.com/mastra-ai/mastra/commit/c6bfd8eb6a10e0fb137893aac87c67ce8ac23b12), [`0c89896`](https://github.com/mastra-ai/mastra/commit/0c8989673fb7d106837098398131e570c6023b68), [`bc3b722`](https://github.com/mastra-ai/mastra/commit/bc3b72225921ebcb05704c3fdf051d69b2f8c3ae), [`93e28ec`](https://github.com/mastra-ai/mastra/commit/93e28ecce9031c02397e0ae8406593e5c7a95883), [`729dab4`](https://github.com/mastra-ai/mastra/commit/729dab408faccfaef0cbb048e5a4338f9172847e), [`484003d`](https://github.com/mastra-ai/mastra/commit/484003d33ff59330c86b19863e4a38732d7e4155), [`933d291`](https://github.com/mastra-ai/mastra/commit/933d291146b789c19442ad206f94da3e4be90c64)]:
  - @mastra/core@1.56.0-alpha.3
  - @mastra/github-signals@0.2.3-alpha.0
  - @mastra/pg@1.19.0-alpha.1
  - @mastra/observability@1.16.4-alpha.1
  - @mastra/memory@1.25.0-alpha.0
  - @mastra/mcp@1.15.0

## 1.1.2-alpha.2

### Patch Changes

- Updated dependencies [[`322daa6`](https://github.com/mastra-ai/mastra/commit/322daa6d90552909204044790d850958f6745fed), [`2c34a58`](https://github.com/mastra-ai/mastra/commit/2c34a58aff529d7f42f883b2c7f3e7d6745fc224), [`cadaa13`](https://github.com/mastra-ai/mastra/commit/cadaa1372e1077c8e85eb64c5499ba8803caa323), [`06000d7`](https://github.com/mastra-ai/mastra/commit/06000d73712911572e913b8a83339270296d0a22), [`3de0188`](https://github.com/mastra-ai/mastra/commit/3de0188bfaf9a9c09c95fe322b53838cf52c70b6)]:
  - @mastra/core@1.56.0-alpha.2
  - @mastra/observability@1.16.4-alpha.0
  - @mastra/mcp@1.15.0

## 1.1.2-alpha.1

### Patch Changes

- Updated dependencies [[`c5e56ff`](https://github.com/mastra-ai/mastra/commit/c5e56ff3bcabdf062708f2d48744fec304df6792), [`c5e56ff`](https://github.com/mastra-ai/mastra/commit/c5e56ff3bcabdf062708f2d48744fec304df6792), [`4e35a56`](https://github.com/mastra-ai/mastra/commit/4e35a56cdf8d74a5ff6d5eda01f2c1deaf6cc7be), [`4e35a56`](https://github.com/mastra-ai/mastra/commit/4e35a56cdf8d74a5ff6d5eda01f2c1deaf6cc7be)]:
  - @mastra/core@1.56.0-alpha.1
  - @mastra/pg@1.19.0-alpha.0
  - @mastra/libsql@1.19.0-alpha.0

## 1.1.2-alpha.0

### Patch Changes

- Updated dependencies [[`7f4e26d`](https://github.com/mastra-ai/mastra/commit/7f4e26dd57bd9b23c278ea21235ab823a3810a6c), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c)]:
  - @mastra/core@1.56.0-alpha.0

## 1.1.1

### Patch Changes

- Extended Mastra Code's transient retry policy to cover provider server errors with up to 10 retries and exponential backoff starting at 500ms. ([#20393](https://github.com/mastra-ai/mastra/pull/20393))

- Improved Mastra Code connection recovery with up to 10 retries, exponential backoff starting at 500ms, and visible retry progress in the TUI. ([#19724](https://github.com/mastra-ai/mastra/pull/19724))

- Fixed the OpenAI pack to use its supported default model ID. ([#20423](https://github.com/mastra-ai/mastra/pull/20423))

- Review sessions now load project AGENTS.md/CLAUDE.md from the pull request's trusted base branch instead of skipping them entirely. The working-tree copies on an untrusted checkout remain excluded from the system prompt and reminder injection; content is served from the base ref via git, and sessions without a known base ref still skip project instruction files. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Fixed sandbox file tools (view, write, edit, list) failing with "Path not found" in Factory sessions when called with absolute paths inside the session working directory. File tools now also work on macOS-hosted local sandboxes, not just Linux VMs. ([#20325](https://github.com/mastra-ai/mastra/pull/20325))

- Sandbox filesystem operations now behave like local ones: missing files, existing destinations, and directory misuse raise typed errors instead of generic ones, reading a directory as a file fails instead of returning empty content, moving or copying a file into a new directory works, overwrite protection can no longer be raced by concurrent writers, and each filesystem reports a unique id and status. ([#20325](https://github.com/mastra-ai/mastra/pull/20325))

- Review sessions no longer ingest AGENTS.md or CLAUDE.md from the checked-out pull request branch. A PR branch is third-party content, so its instruction files are treated as content under review instead of trusted configuration — closing a prompt-injection path into the reviewer agent. The reviewer also runs the PR's install/build/test commands with GitHub tokens stripped from the environment. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Added an option to the instruction-file reminder processor that lets hosts disable injection entirely for a request, so instruction files from untrusted checkouts are never surfaced as reminders. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Updated dependencies [[`1288cba`](https://github.com/mastra-ai/mastra/commit/1288cba09b8ab906dba38270c7e2a75400344a98), [`3f472b4`](https://github.com/mastra-ai/mastra/commit/3f472b468892a1ff14ccb43cc0343b86f7d8fd7d), [`ba369f2`](https://github.com/mastra-ai/mastra/commit/ba369f2a0aaf998da0d6aa033d26f64f96bef8ac), [`35b929b`](https://github.com/mastra-ai/mastra/commit/35b929b7abc3d20d85c7985880960ac2d04a6c86), [`55c9e24`](https://github.com/mastra-ai/mastra/commit/55c9e248c27c1d72b5bb7e94ea6b8a3999eee49f), [`dcfed93`](https://github.com/mastra-ai/mastra/commit/dcfed93e1e256c6abfa792cbb7ca836f5d0e8638), [`2876e15`](https://github.com/mastra-ai/mastra/commit/2876e15b4d2f616a3bc1ed3af57d546c268384ce), [`9b3626a`](https://github.com/mastra-ai/mastra/commit/9b3626aeb1d16fcd34b0a8e94c114ddb80a3b240), [`4696963`](https://github.com/mastra-ai/mastra/commit/469696312ac4c618bc8475b0c5ed7949b8a3455e), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`07f5b4b`](https://github.com/mastra-ai/mastra/commit/07f5b4ba9d608d88865030732e580298296adf99), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`598080f`](https://github.com/mastra-ai/mastra/commit/598080f224edb3f0f5b801035b067fac50a56a03)]:
  - @mastra/pg@1.18.1
  - @mastra/core@1.55.0

## 1.1.1-alpha.3

### Patch Changes

- Review sessions now load project AGENTS.md/CLAUDE.md from the pull request's trusted base branch instead of skipping them entirely. The working-tree copies on an untrusted checkout remain excluded from the system prompt and reminder injection; content is served from the base ref via git, and sessions without a known base ref still skip project instruction files. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Review sessions no longer ingest AGENTS.md or CLAUDE.md from the checked-out pull request branch. A PR branch is third-party content, so its instruction files are treated as content under review instead of trusted configuration — closing a prompt-injection path into the reviewer agent. The reviewer also runs the PR's install/build/test commands with GitHub tokens stripped from the environment. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Added an option to the instruction-file reminder processor that lets hosts disable injection entirely for a request, so instruction files from untrusted checkouts are never surfaced as reminders. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Updated dependencies [[`1288cba`](https://github.com/mastra-ai/mastra/commit/1288cba09b8ab906dba38270c7e2a75400344a98), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73)]:
  - @mastra/pg@1.18.1-alpha.0
  - @mastra/core@1.55.0-alpha.3

## 1.1.1-alpha.2

### Patch Changes

- Extended Mastra Code's transient retry policy to cover provider server errors with up to 10 retries and exponential backoff starting at 500ms. ([#20393](https://github.com/mastra-ai/mastra/pull/20393))

- Updated dependencies [[`55c9e24`](https://github.com/mastra-ai/mastra/commit/55c9e248c27c1d72b5bb7e94ea6b8a3999eee49f), [`07f5b4b`](https://github.com/mastra-ai/mastra/commit/07f5b4ba9d608d88865030732e580298296adf99)]:
  - @mastra/core@1.55.0-alpha.2

## 1.1.1-alpha.1

### Patch Changes

- Fixed sandbox file tools (view, write, edit, list) failing with "Path not found" in Factory sessions when called with absolute paths inside the session working directory. File tools now also work on macOS-hosted local sandboxes, not just Linux VMs. ([#20325](https://github.com/mastra-ai/mastra/pull/20325))

- Sandbox filesystem operations now behave like local ones: missing files, existing destinations, and directory misuse raise typed errors instead of generic ones, reading a directory as a file fails instead of returning empty content, moving or copying a file into a new directory works, overwrite protection can no longer be raced by concurrent writers, and each filesystem reports a unique id and status. ([#20325](https://github.com/mastra-ai/mastra/pull/20325))

- Updated dependencies [[`ba369f2`](https://github.com/mastra-ai/mastra/commit/ba369f2a0aaf998da0d6aa033d26f64f96bef8ac), [`dcfed93`](https://github.com/mastra-ai/mastra/commit/dcfed93e1e256c6abfa792cbb7ca836f5d0e8638), [`2876e15`](https://github.com/mastra-ai/mastra/commit/2876e15b4d2f616a3bc1ed3af57d546c268384ce), [`598080f`](https://github.com/mastra-ai/mastra/commit/598080f224edb3f0f5b801035b067fac50a56a03)]:
  - @mastra/core@1.55.0-alpha.1

## 1.1.1-alpha.0

### Patch Changes

- Improved Mastra Code connection recovery with up to 10 retries, exponential backoff starting at 500ms, and visible retry progress in the TUI. ([#19724](https://github.com/mastra-ai/mastra/pull/19724))

- Updated dependencies [[`3f472b4`](https://github.com/mastra-ai/mastra/commit/3f472b468892a1ff14ccb43cc0343b86f7d8fd7d), [`35b929b`](https://github.com/mastra-ai/mastra/commit/35b929b7abc3d20d85c7985880960ac2d04a6c86), [`9b3626a`](https://github.com/mastra-ai/mastra/commit/9b3626aeb1d16fcd34b0a8e94c114ddb80a3b240)]:
  - @mastra/core@1.55.0-alpha.0

## 1.1.0

### Minor Changes

- Added `resolveProviderOMDefault` to `@mastra/code-sdk/onboarding/packs`, which returns the small, cheap observational memory model for a provider, or the model you pass in when that provider has none. ([#20298](https://github.com/mastra-ai/mastra/pull/20298))

  The built-in OM packs are now a single table, so the list offered during onboarding and the per-provider default can no longer drift apart.

  ```ts
  import { resolveProviderOMDefault } from '@mastra/code-sdk/onboarding/packs';

  resolveProviderOMDefault('anthropic').modelId; // 'anthropic/claude-haiku-4-5'
  resolveProviderOMDefault('openai-codex').modelId; // 'openai/gpt-5.4-mini'
  resolveProviderOMDefault('xai', 'xai/grok-4.5').modelId; // 'xai/grok-4.5'
  ```

- Added provider-aware observational memory defaults, so a controller started without a stored OM choice observes and reflects with the cheap model of a provider you can actually reach instead of the built-in Gemini default. ([#20291](https://github.com/mastra-ai/mastra/pull/20291))

  The helpers behind it are exported if you build your own surface on the SDK:

  ```ts
  import { hasExplicitOMConfiguration } from '@mastra/code-sdk/onboarding/om-settings';
  import { selectPreferredOMPack } from '@mastra/code-sdk/onboarding/packs';

  // Best OM pack across everything the user can reach, preferring a given provider
  selectPreferredOMPack({ anthropic: 'oauth', google: 'apikey' }, 'anthropic')?.modelId;

  // True once the user picked an OM model or pack themselves — never seed over it
  hasExplicitOMConfiguration(settings);
  ```

### Patch Changes

- Updated dependencies [[`ce93a3c`](https://github.com/mastra-ai/mastra/commit/ce93a3c114ea1cbfbd576f3db41d7c26c9844f5b), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`a211d09`](https://github.com/mastra-ai/mastra/commit/a211d09185dc65a746534914cf38b67f21ee9bac), [`0dca9d0`](https://github.com/mastra-ai/mastra/commit/0dca9d0b1356024a53b72ea6f040db528b126caa), [`6218217`](https://github.com/mastra-ai/mastra/commit/62182171b6cfca0b099f1c6a77a2e65e7639ab86), [`5807d3a`](https://github.com/mastra-ai/mastra/commit/5807d3ae1d259b8b7d6df7e5bf2b485c694af9c8), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`05db566`](https://github.com/mastra-ai/mastra/commit/05db566fcbdcbf33d0bffca0c72ec30129e2e3ca), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`273bb71`](https://github.com/mastra-ai/mastra/commit/273bb71e82e74b656f3906288239429899398c0c), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`05db566`](https://github.com/mastra-ai/mastra/commit/05db566fcbdcbf33d0bffca0c72ec30129e2e3ca), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`d1b7e3a`](https://github.com/mastra-ai/mastra/commit/d1b7e3a978a309a5653eeaa490d2d6c7c53bd093), [`29c584a`](https://github.com/mastra-ai/mastra/commit/29c584a13a88831e5ed1fdeb0ff8e82eae180433), [`c093146`](https://github.com/mastra-ai/mastra/commit/c0931466404d3c521308ea119cb165bb7e695155), [`e075db9`](https://github.com/mastra-ai/mastra/commit/e075db9715c836bae5dfc37c50248492af397c3b), [`8124754`](https://github.com/mastra-ai/mastra/commit/8124754ae89fbc69f8136d1df4a91904d0f84c4e), [`d12b2e4`](https://github.com/mastra-ai/mastra/commit/d12b2e4023fd9e3d3e93a9169f5088bcee2a849c), [`d1b7e3a`](https://github.com/mastra-ai/mastra/commit/d1b7e3a978a309a5653eeaa490d2d6c7c53bd093)]:
  - @mastra/core@1.54.0
  - @mastra/libsql@1.18.0
  - @mastra/memory@1.24.0
  - @mastra/pg@1.18.0
  - @mastra/duckdb@1.5.2
  - @mastra/observability@1.16.3
  - @mastra/mcp@1.15.0

## 1.1.0-alpha.4

### Patch Changes

- Updated dependencies [[`6218217`](https://github.com/mastra-ai/mastra/commit/62182171b6cfca0b099f1c6a77a2e65e7639ab86), [`d12b2e4`](https://github.com/mastra-ai/mastra/commit/d12b2e4023fd9e3d3e93a9169f5088bcee2a849c)]:
  - @mastra/core@1.54.0-alpha.4

## 1.1.0-alpha.3

### Patch Changes

- Updated dependencies [[`29c584a`](https://github.com/mastra-ai/mastra/commit/29c584a13a88831e5ed1fdeb0ff8e82eae180433)]:
  - @mastra/core@1.54.0-alpha.3

## 1.1.0-alpha.2

### Minor Changes

- Added `resolveProviderOMDefault` to `@mastra/code-sdk/onboarding/packs`, which returns the small, cheap observational memory model for a provider, or the model you pass in when that provider has none. ([#20298](https://github.com/mastra-ai/mastra/pull/20298))

  The built-in OM packs are now a single table, so the list offered during onboarding and the per-provider default can no longer drift apart.

  ```ts
  import { resolveProviderOMDefault } from '@mastra/code-sdk/onboarding/packs';

  resolveProviderOMDefault('anthropic').modelId; // 'anthropic/claude-haiku-4-5'
  resolveProviderOMDefault('openai-codex').modelId; // 'openai/gpt-5.4-mini'
  resolveProviderOMDefault('xai', 'xai/grok-4.5').modelId; // 'xai/grok-4.5'
  ```

- Added provider-aware observational memory defaults, so a controller started without a stored OM choice observes and reflects with the cheap model of a provider you can actually reach instead of the built-in Gemini default. ([#20291](https://github.com/mastra-ai/mastra/pull/20291))

  The helpers behind it are exported if you build your own surface on the SDK:

  ```ts
  import { hasExplicitOMConfiguration } from '@mastra/code-sdk/onboarding/om-settings';
  import { selectPreferredOMPack } from '@mastra/code-sdk/onboarding/packs';

  // Best OM pack across everything the user can reach, preferring a given provider
  selectPreferredOMPack({ anthropic: 'oauth', google: 'apikey' }, 'anthropic')?.modelId;

  // True once the user picked an OM model or pack themselves — never seed over it
  hasExplicitOMConfiguration(settings);
  ```

### Patch Changes

- Updated dependencies [[`a211d09`](https://github.com/mastra-ai/mastra/commit/a211d09185dc65a746534914cf38b67f21ee9bac), [`05db566`](https://github.com/mastra-ai/mastra/commit/05db566fcbdcbf33d0bffca0c72ec30129e2e3ca), [`05db566`](https://github.com/mastra-ai/mastra/commit/05db566fcbdcbf33d0bffca0c72ec30129e2e3ca), [`e075db9`](https://github.com/mastra-ai/mastra/commit/e075db9715c836bae5dfc37c50248492af397c3b), [`8124754`](https://github.com/mastra-ai/mastra/commit/8124754ae89fbc69f8136d1df4a91904d0f84c4e)]:
  - @mastra/core@1.54.0-alpha.2
  - @mastra/pg@1.18.0-alpha.2
  - @mastra/libsql@1.18.0-alpha.1

## 1.0.3-alpha.1

### Patch Changes

- Updated dependencies [[`ce93a3c`](https://github.com/mastra-ai/mastra/commit/ce93a3c114ea1cbfbd576f3db41d7c26c9844f5b), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`5807d3a`](https://github.com/mastra-ai/mastra/commit/5807d3ae1d259b8b7d6df7e5bf2b485c694af9c8), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`273bb71`](https://github.com/mastra-ai/mastra/commit/273bb71e82e74b656f3906288239429899398c0c), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`d1b7e3a`](https://github.com/mastra-ai/mastra/commit/d1b7e3a978a309a5653eeaa490d2d6c7c53bd093), [`c093146`](https://github.com/mastra-ai/mastra/commit/c0931466404d3c521308ea119cb165bb7e695155), [`d1b7e3a`](https://github.com/mastra-ai/mastra/commit/d1b7e3a978a309a5653eeaa490d2d6c7c53bd093)]:
  - @mastra/core@1.54.0-alpha.1
  - @mastra/pg@1.18.0-alpha.1
  - @mastra/duckdb@1.5.2-alpha.0
  - @mastra/observability@1.16.3-alpha.0
  - @mastra/mcp@1.15.0

## 1.0.3-alpha.0

### Patch Changes

- Updated dependencies [[`0dca9d0`](https://github.com/mastra-ai/mastra/commit/0dca9d0b1356024a53b72ea6f040db528b126caa)]:
  - @mastra/core@1.54.0-alpha.0
  - @mastra/libsql@1.18.0-alpha.0
  - @mastra/memory@1.24.0-alpha.0
  - @mastra/pg@1.18.0-alpha.0

## 1.0.2

### Patch Changes

- Fixed stored provider API keys so authenticated models appear as configured and continue working during steering and follow-up messages. ([#20143](https://github.com/mastra-ai/mastra/pull/20143))

- Added a 15s `AbortSignal` timeout to the Anthropic OAuth token-exchange and refresh fetches so an unresponsive upstream cannot pin the caller indefinitely. ([#20129](https://github.com/mastra-ai/mastra/pull/20129))

- Updated dependencies [[`c8d8a01`](https://github.com/mastra-ai/mastra/commit/c8d8a010ee2efe2b7bf4d07707382c34c87b14e4), [`df6a9ce`](https://github.com/mastra-ai/mastra/commit/df6a9ce87214f7aadb2edfe62f67605fe998a0a4), [`73839cb`](https://github.com/mastra-ai/mastra/commit/73839cb58322679c170627d1015669ede5f619aa), [`371cf60`](https://github.com/mastra-ai/mastra/commit/371cf6075cef88ac6919a08d59a82e485397364a), [`8e4dc79`](https://github.com/mastra-ai/mastra/commit/8e4dc793dcf035ea506f9ce79f56d2d501a4be14), [`0f92ed4`](https://github.com/mastra-ai/mastra/commit/0f92ed4173a480f617c6a0af6d51af100b42bdfc), [`2db93cc`](https://github.com/mastra-ai/mastra/commit/2db93ccd0b872e4de7853a93383efe0647901df8), [`094ab61`](https://github.com/mastra-ai/mastra/commit/094ab6129a1a3ecf6eeb86decac17d5faea4e02a), [`fe80944`](https://github.com/mastra-ai/mastra/commit/fe80944f3ef6681fea6eae8200fce387b7bb3c2f), [`9fdb1b5`](https://github.com/mastra-ai/mastra/commit/9fdb1b50c39742e1a01b319a864754c90e7aa947), [`263d2ca`](https://github.com/mastra-ai/mastra/commit/263d2cac80ba3b03b9c0f008db6f1f1b9eb0278c), [`8e4dc79`](https://github.com/mastra-ai/mastra/commit/8e4dc793dcf035ea506f9ce79f56d2d501a4be14), [`75f843d`](https://github.com/mastra-ai/mastra/commit/75f843d09f758223e6eeb321321bdcc5c7e779d0), [`e51e166`](https://github.com/mastra-ai/mastra/commit/e51e166c52e220abc9b64554ce37359dca8544b1)]:
  - @mastra/core@1.53.0
  - @mastra/pg@1.17.1
  - @mastra/libsql@1.17.1

## 1.0.2-alpha.4

### Patch Changes

- Fixed stored provider API keys so authenticated models appear as configured and continue working during steering and follow-up messages. ([#20143](https://github.com/mastra-ai/mastra/pull/20143))

- Updated dependencies [[`73839cb`](https://github.com/mastra-ai/mastra/commit/73839cb58322679c170627d1015669ede5f619aa), [`8e4dc79`](https://github.com/mastra-ai/mastra/commit/8e4dc793dcf035ea506f9ce79f56d2d501a4be14), [`2db93cc`](https://github.com/mastra-ai/mastra/commit/2db93ccd0b872e4de7853a93383efe0647901df8), [`094ab61`](https://github.com/mastra-ai/mastra/commit/094ab6129a1a3ecf6eeb86decac17d5faea4e02a), [`fe80944`](https://github.com/mastra-ai/mastra/commit/fe80944f3ef6681fea6eae8200fce387b7bb3c2f), [`9fdb1b5`](https://github.com/mastra-ai/mastra/commit/9fdb1b50c39742e1a01b319a864754c90e7aa947), [`8e4dc79`](https://github.com/mastra-ai/mastra/commit/8e4dc793dcf035ea506f9ce79f56d2d501a4be14), [`e51e166`](https://github.com/mastra-ai/mastra/commit/e51e166c52e220abc9b64554ce37359dca8544b1)]:
  - @mastra/core@1.53.0-alpha.4
  - @mastra/pg@1.17.1-alpha.0
  - @mastra/libsql@1.17.1-alpha.1

## 1.0.2-alpha.3

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.53.0-alpha.3

## 1.0.2-alpha.2

### Patch Changes

- Updated dependencies [[`75f843d`](https://github.com/mastra-ai/mastra/commit/75f843d09f758223e6eeb321321bdcc5c7e779d0)]:
  - @mastra/core@1.53.0-alpha.2

## 1.0.2-alpha.1

### Patch Changes

- Updated dependencies [[`c8d8a01`](https://github.com/mastra-ai/mastra/commit/c8d8a010ee2efe2b7bf4d07707382c34c87b14e4), [`371cf60`](https://github.com/mastra-ai/mastra/commit/371cf6075cef88ac6919a08d59a82e485397364a), [`263d2ca`](https://github.com/mastra-ai/mastra/commit/263d2cac80ba3b03b9c0f008db6f1f1b9eb0278c)]:
  - @mastra/core@1.53.0-alpha.1

## 1.0.2-alpha.0

### Patch Changes

- Added a 15s `AbortSignal` timeout to the Anthropic OAuth token-exchange and refresh fetches so an unresponsive upstream cannot pin the caller indefinitely. ([#20129](https://github.com/mastra-ai/mastra/pull/20129))

- Updated dependencies [[`df6a9ce`](https://github.com/mastra-ai/mastra/commit/df6a9ce87214f7aadb2edfe62f67605fe998a0a4), [`0f92ed4`](https://github.com/mastra-ai/mastra/commit/0f92ed4173a480f617c6a0af6d51af100b42bdfc)]:
  - @mastra/core@1.52.2-alpha.0
  - @mastra/libsql@1.17.1-alpha.0

## 1.0.1

### Patch Changes

- Updated dependencies [[`55adddf`](https://github.com/mastra-ai/mastra/commit/55adddfda2a170b00c112bf37d677e8ce5b65d5a)]:
  - @mastra/core@1.52.1

## 1.0.1-alpha.0

### Patch Changes

- Updated dependencies [[`55adddf`](https://github.com/mastra-ai/mastra/commit/55adddfda2a170b00c112bf37d677e8ce5b65d5a)]:
  - @mastra/core@1.52.1-alpha.0

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
