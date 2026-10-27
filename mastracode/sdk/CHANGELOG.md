# @mastra/code-sdk

## 1.16.0-alpha.6

### Minor Changes

- Mastra Code no longer registers subagents unless you turn them on. `createMastraCode()` and `mountAgentControllerOnMastra()` now default `subagents` to an empty list. ([#28600](https://github.com/mastra-ai/mastra/pull/28600))

  Before, omitting `subagents` registered the explore, plan and execute subagents:

  ```ts
  await createMastraCode();
  ```

  After, pass `builtinSubagents` to keep them:

  ```ts
  import { builtinSubagents, createMastraCode } from '@mastra/code-sdk';

  await createMastraCode({ subagents: [...builtinSubagents] });
  ```

  The same applies to `mountAgentControllerOnMastra()`.

  The TUI, headless `mastracode --prompt` runs and ACP sessions all read the `subagentsEnabled` setting (toggled with `/subagents`, off by default), so subagents only run when a user opts in.

### Patch Changes

- Fixed tool calls on Amazon Bedrock models failing with `AI_TypeValidationError` when zod 4.4 or newer is installed. Bedrock streams the start of a tool call without its input, which the old `@ai-sdk/amazon-bedrock` 3.x schema rejected. The Bedrock provider is now `@ai-sdk/amazon-bedrock` v5, which accepts these events. ([#28515](https://github.com/mastra-ai/mastra/pull/28515))

- An exhausted provider quota now shows its own error and a hint to check the account's billing or usage allowance, instead of being reported as a rate limit with "Wait a moment and try again". ([#28496](https://github.com/mastra-ai/mastra/pull/28496))

  Account rotation and transient server error detection now read failures through the shared provider error reader in `@mastra/core/error`. A credential, usage or rate-limit failure named only in a provider's response body or stream frame now rotates to the next account, and an overloaded stream frame is retried as a server error.

- Updated dependencies [[`347f562`](https://github.com/mastra-ai/mastra/commit/347f562ff20b0b61fc4e5e8b58b8b0aac971b3cd), [`168e0ab`](https://github.com/mastra-ai/mastra/commit/168e0abe689f5591d9ab834057351f79e62a881e), [`24a821b`](https://github.com/mastra-ai/mastra/commit/24a821b0ff29f527787c0645a7bf7bbe50d27f57), [`38ff787`](https://github.com/mastra-ai/mastra/commit/38ff787998d56210cfd938439af0fea68703a196), [`1fc075a`](https://github.com/mastra-ai/mastra/commit/1fc075ab7f7eddca854512d21149db8212f422eb), [`1fc075a`](https://github.com/mastra-ai/mastra/commit/1fc075ab7f7eddca854512d21149db8212f422eb), [`38ff787`](https://github.com/mastra-ai/mastra/commit/38ff787998d56210cfd938439af0fea68703a196), [`4ad204d`](https://github.com/mastra-ai/mastra/commit/4ad204dc5bdde76dca26cb7d87c48dd11f97316d), [`9ffb79b`](https://github.com/mastra-ai/mastra/commit/9ffb79b17e6ed0f0ec6bd1640218ef2a5fb7c058), [`155e3ac`](https://github.com/mastra-ai/mastra/commit/155e3aca3e57114ce3393bd88f6848c29f37c82b), [`7c20f00`](https://github.com/mastra-ai/mastra/commit/7c20f008c84db8f4f49e6e95d6dc965482bb2039), [`4ad204d`](https://github.com/mastra-ai/mastra/commit/4ad204dc5bdde76dca26cb7d87c48dd11f97316d), [`680b01a`](https://github.com/mastra-ai/mastra/commit/680b01acd54b1af3f18d20d8deb9c42d35258902), [`e56f88e`](https://github.com/mastra-ai/mastra/commit/e56f88e18d906635b033173abcae637cf361ce8a), [`cd4722a`](https://github.com/mastra-ai/mastra/commit/cd4722a583a0eb75022b1da6a6f8210f8126e486), [`5e88354`](https://github.com/mastra-ai/mastra/commit/5e883545edd6082e741cdce1d192e0e83fa5dc2e), [`852110d`](https://github.com/mastra-ai/mastra/commit/852110d4eeaf5ab74ea94747343501700033a1e8), [`2499c00`](https://github.com/mastra-ai/mastra/commit/2499c00181520cf7cda756729dc0e0085b85454f), [`c9445e0`](https://github.com/mastra-ai/mastra/commit/c9445e008d8036cad08bca9dd61b698d72fa96bf), [`d580530`](https://github.com/mastra-ai/mastra/commit/d580530ff36d43e752b1f838b3f8e16017e8f92b), [`4fc17c6`](https://github.com/mastra-ai/mastra/commit/4fc17c65e85628a71201bf7490fca1db8376cf71), [`682ebf6`](https://github.com/mastra-ai/mastra/commit/682ebf6b6f867224acbcb021fc142b902738ad07), [`dd6205e`](https://github.com/mastra-ai/mastra/commit/dd6205e985e5fd76b59d000076ab199143c989eb), [`97ade4e`](https://github.com/mastra-ai/mastra/commit/97ade4e8621a9afd01a1f38b921519ddc3086568), [`c8b8e27`](https://github.com/mastra-ai/mastra/commit/c8b8e27e9b26d9a08bc61d2e663804f25ae4fa2d), [`1fc075a`](https://github.com/mastra-ai/mastra/commit/1fc075ab7f7eddca854512d21149db8212f422eb), [`d1aee64`](https://github.com/mastra-ai/mastra/commit/d1aee64e65968744c118440d2d01eb4fba3616d6), [`0b7e619`](https://github.com/mastra-ai/mastra/commit/0b7e61996ede043dc4b134fc35b1fff51d638a46), [`9a9085e`](https://github.com/mastra-ai/mastra/commit/9a9085ef3481c31093152ea9976759c72dc3fd89), [`9a83d42`](https://github.com/mastra-ai/mastra/commit/9a83d42b2461dd1629021d05704939b641330d5b), [`2447071`](https://github.com/mastra-ai/mastra/commit/2447071b11d7a5f159e6dc726eb5df0aa0db69da), [`ab1727d`](https://github.com/mastra-ai/mastra/commit/ab1727d5cafb64e36b04fad9f8871dc6640d2420), [`ab1727d`](https://github.com/mastra-ai/mastra/commit/ab1727d5cafb64e36b04fad9f8871dc6640d2420), [`ab1727d`](https://github.com/mastra-ai/mastra/commit/ab1727d5cafb64e36b04fad9f8871dc6640d2420), [`ab1727d`](https://github.com/mastra-ai/mastra/commit/ab1727d5cafb64e36b04fad9f8871dc6640d2420), [`4fc17c6`](https://github.com/mastra-ai/mastra/commit/4fc17c65e85628a71201bf7490fca1db8376cf71), [`ddb7721`](https://github.com/mastra-ai/mastra/commit/ddb77211bc797c45fe434baac5c44c4193c1381e), [`d1aee64`](https://github.com/mastra-ai/mastra/commit/d1aee64e65968744c118440d2d01eb4fba3616d6), [`852110d`](https://github.com/mastra-ai/mastra/commit/852110d4eeaf5ab74ea94747343501700033a1e8), [`5e88354`](https://github.com/mastra-ai/mastra/commit/5e883545edd6082e741cdce1d192e0e83fa5dc2e), [`5bb592a`](https://github.com/mastra-ai/mastra/commit/5bb592a862869d529d8d6ca48772cd0e1863f224), [`4278b9d`](https://github.com/mastra-ai/mastra/commit/4278b9dfb8aef7f274e4dfb102597cc0400475ee), [`45c1d16`](https://github.com/mastra-ai/mastra/commit/45c1d16c4f0cd3e5b18d2a788fb998c70b45b7c0), [`a9f392e`](https://github.com/mastra-ai/mastra/commit/a9f392e60e5bc1fab66280314bab5f697e8d7c09), [`0811cda`](https://github.com/mastra-ai/mastra/commit/0811cda8d22476cf1393b429a63aaefa5292048c), [`3cdaaa8`](https://github.com/mastra-ai/mastra/commit/3cdaaa86f48812bdae1077e55be1d58dd5e85fc5), [`852110d`](https://github.com/mastra-ai/mastra/commit/852110d4eeaf5ab74ea94747343501700033a1e8), [`b63456b`](https://github.com/mastra-ai/mastra/commit/b63456befb5f51d1a2b1288225f02c30738b6099), [`580452a`](https://github.com/mastra-ai/mastra/commit/580452acbbb9812eae1b31d4f3ded716c348a78b)]:
  - @mastra/client-js@1.57.0-alpha.5
  - @mastra/core@1.80.0-alpha.5
  - @mastra/observability@1.22.0-alpha.3
  - @mastra/fastembed@1.3.5-alpha.3
  - @mastra/libsql@1.27.1-alpha.1
  - @mastra/pg@1.33.0-alpha.3
  - @mastra/mcp@2.6.0-alpha.2
  - @mastra/memory@1.39.1-alpha.3
  - @mastra/duckdb@1.16.0-alpha.2

## 1.15.1-alpha.5

### Patch Changes

- dependencies updates: ([#28417](https://github.com/mastra-ai/mastra/pull/28417))
  - Updated dependency [`@agentclientprotocol/sdk@^0.21.1` ↗︎](https://www.npmjs.com/package/@agentclientprotocol/sdk/v/0.21.1) (from `^0.21.0`, in `dependencies`)
  - Updated dependency [`@ai-sdk/amazon-bedrock@^3.0.141` ↗︎](https://www.npmjs.com/package/@ai-sdk/amazon-bedrock/v/3.0.141) (from `^3.0.140`, in `dependencies`)
  - Updated dependency [`@ai-sdk/anthropic@^3.0.135` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/3.0.135) (from `^3.0.133`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai@^3.0.131` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai/v/3.0.131) (from `^3.0.130`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai-compatible@^2.0.87` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai-compatible/v/2.0.87) (from `^2.0.85`, in `dependencies`)
  - Updated dependency [`@ast-grep/napi@^0.42.3` ↗︎](https://www.npmjs.com/package/@ast-grep/napi/v/0.42.3) (from `^0.42.0`, in `dependencies`)
  - Updated dependency [`@aws-sdk/credential-providers@^3.1156.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/credential-providers/v/3.1156.0) (from `^3.1095.0`, in `dependencies`)
  - Updated dependency [`ai@^6.0.315` ↗︎](https://www.npmjs.com/package/ai/v/6.0.315) (from `^6.0.309`, in `dependencies`)
  - Updated dependency [`posthog-node@^5.57.1` ↗︎](https://www.npmjs.com/package/posthog-node/v/5.57.1) (from `^5.46.1`, in `dependencies`)
  - Updated dependency [`tokenx@^1.6.0` ↗︎](https://www.npmjs.com/package/tokenx/v/1.6.0) (from `^1.3.0`, in `dependencies`)
  - Updated dependency [`vscode-languageserver-protocol@^3.18.5` ↗︎](https://www.npmjs.com/package/vscode-languageserver-protocol/v/3.18.5) (from `^3.18.4`, in `dependencies`)
  - Updated dependency [`yaml@^2.9.1` ↗︎](https://www.npmjs.com/package/yaml/v/2.9.1) (from `^2.7.1`, in `dependencies`)
  - Updated dependency [`@copilotkit/aimock@^1.46.0` ↗︎](https://www.npmjs.com/package/@copilotkit/aimock/v/1.46.0) (from `^1.29.0`, in `devDependencies`)
  - Updated dependency [`@types/node@22.19.15` ↗︎](https://www.npmjs.com/package/@types/node/v/22.19.15) (from `22.20.5`, in `devDependencies`)

- Fixed Outcome scoring so build and test results recognize successful and failed execute_command commands, and regression scoring detects failures after a prior pass. ([#28406](https://github.com/mastra-ai/mastra/pull/28406))

- Fixed duplicate Core installations when embedding the Code SDK by requiring applications to provide @mastra/core 1.80 or later. ([#28419](https://github.com/mastra-ai/mastra/pull/28419))

- Fixed `read_file` returning images and PDFs as text when the workspace uses `SandboxFilesystem`. `SandboxFilesystem.stat()` now reports `mimeType` for files, so PNG, JPEG, WebP and PDF files reach the model as native media, the same as with `LocalFilesystem`. When the sandbox has its own filesystem, a MIME type it supplies is kept and is only inferred from the extension when missing. Directories do not get an inferred MIME type. Shell-backed `stat()` also follows symlinks to their target, so a symlink reports its target's type and size. Fixes #28264. ([#28302](https://github.com/mastra-ai/mastra/pull/28302))

- Subscription providers (Anthropic, OpenAI Codex, GitHub Copilot, xAI, Kimi For Coding) now say "<Provider> sign-in expired." when a saved sign-in can no longer be renewed, matching the **Sign-in expired** status in Settings. Before, Anthropic said "Not logged in to Anthropic." and the others said "Failed to refresh the <Provider> token." "Not logged in to <Provider>." is now only shown when no sign-in is saved. ([#28401](https://github.com/mastra-ai/mastra/pull/28401))

- Updated dependencies [[`ce5d473`](https://github.com/mastra-ai/mastra/commit/ce5d4731eeeb44779748852618b95c5cb6485bed), [`ce5d473`](https://github.com/mastra-ai/mastra/commit/ce5d4731eeeb44779748852618b95c5cb6485bed), [`ce5d473`](https://github.com/mastra-ai/mastra/commit/ce5d4731eeeb44779748852618b95c5cb6485bed), [`ce5d473`](https://github.com/mastra-ai/mastra/commit/ce5d4731eeeb44779748852618b95c5cb6485bed), [`ce5d473`](https://github.com/mastra-ai/mastra/commit/ce5d4731eeeb44779748852618b95c5cb6485bed), [`ce5d473`](https://github.com/mastra-ai/mastra/commit/ce5d4731eeeb44779748852618b95c5cb6485bed), [`ce5d473`](https://github.com/mastra-ai/mastra/commit/ce5d4731eeeb44779748852618b95c5cb6485bed), [`ce5d473`](https://github.com/mastra-ai/mastra/commit/ce5d4731eeeb44779748852618b95c5cb6485bed), [`ce5d473`](https://github.com/mastra-ai/mastra/commit/ce5d4731eeeb44779748852618b95c5cb6485bed), [`ce5d473`](https://github.com/mastra-ai/mastra/commit/ce5d4731eeeb44779748852618b95c5cb6485bed), [`ce5d473`](https://github.com/mastra-ai/mastra/commit/ce5d4731eeeb44779748852618b95c5cb6485bed), [`ce5d473`](https://github.com/mastra-ai/mastra/commit/ce5d4731eeeb44779748852618b95c5cb6485bed), [`ce5d473`](https://github.com/mastra-ai/mastra/commit/ce5d4731eeeb44779748852618b95c5cb6485bed), [`0a913e0`](https://github.com/mastra-ai/mastra/commit/0a913e096cb569aea396fa3d9f286cc874179ce8), [`3dfe2eb`](https://github.com/mastra-ai/mastra/commit/3dfe2eb8c3ef3b18d2395a3618b6214488963d05), [`152e380`](https://github.com/mastra-ai/mastra/commit/152e380aca6fcf74f598a158c710c0e755ceb325), [`99e4867`](https://github.com/mastra-ai/mastra/commit/99e486723d3f0063ae70a39c9840daf92a98fa23), [`929a728`](https://github.com/mastra-ai/mastra/commit/929a7281d411ac515e0befb53a5383741b06d484), [`52db47c`](https://github.com/mastra-ai/mastra/commit/52db47cd0d66f891d41a2dbfa36e55b640a30a37), [`14f209c`](https://github.com/mastra-ai/mastra/commit/14f209ceefc27d0ee75773fd4aa3e8160cdccab5), [`7adffbb`](https://github.com/mastra-ai/mastra/commit/7adffbb3df2f734b59648dcf8d461e7af8d1f914), [`f51a29e`](https://github.com/mastra-ai/mastra/commit/f51a29e82b6e2371b5c6aed46141ce20f099c9a9), [`063b292`](https://github.com/mastra-ai/mastra/commit/063b292e15d0c09b7c77d9c0d162792ccf5985d8), [`0f2c708`](https://github.com/mastra-ai/mastra/commit/0f2c70879a336fd00ae55a1474651fe418563dd3), [`c73d201`](https://github.com/mastra-ai/mastra/commit/c73d201c620760d9699901b2460f728a8ca19c1e), [`1bc29c2`](https://github.com/mastra-ai/mastra/commit/1bc29c2406dcba63e310e7c7691425b0257f11d0), [`5c0a994`](https://github.com/mastra-ai/mastra/commit/5c0a99438ef82cf5584218f250a023371bab3373), [`7adffbb`](https://github.com/mastra-ai/mastra/commit/7adffbb3df2f734b59648dcf8d461e7af8d1f914), [`ffc663d`](https://github.com/mastra-ai/mastra/commit/ffc663d2ba4f9c301cbc03ca17c12e351f27330f), [`823a389`](https://github.com/mastra-ai/mastra/commit/823a3890deb5cf14484fd655c8360df4c41c4aed), [`ff35b8c`](https://github.com/mastra-ai/mastra/commit/ff35b8c3d86136509d31b87fed7f789a572dc1af), [`501b207`](https://github.com/mastra-ai/mastra/commit/501b207b1b6300af44b5b8f40ff33adfe7a9d195), [`d9245dd`](https://github.com/mastra-ai/mastra/commit/d9245dd486349163bfc6468ab45e5600abc6a59e), [`358c711`](https://github.com/mastra-ai/mastra/commit/358c71145d677394ce03a019156bc464afe6cc76), [`dbdfaee`](https://github.com/mastra-ai/mastra/commit/dbdfaee279dab2a5dca31134ca1967eb582e639c), [`fdd2201`](https://github.com/mastra-ai/mastra/commit/fdd22014f6fbfa115eba53cff42063544af2ff41), [`501b207`](https://github.com/mastra-ai/mastra/commit/501b207b1b6300af44b5b8f40ff33adfe7a9d195), [`68f311e`](https://github.com/mastra-ai/mastra/commit/68f311e0dac06b2ff337727d8e72892f1d8d337f), [`4303017`](https://github.com/mastra-ai/mastra/commit/4303017f393b9c09f692837d8e9e7a19f6539cf4)]:
  - @mastra/agent-browser@0.5.5-alpha.0
  - @mastra/client-js@1.57.0-alpha.4
  - @mastra/core@1.80.0-alpha.4
  - @mastra/duckdb@1.16.0-alpha.1
  - @mastra/fastembed@1.3.5-alpha.2
  - @mastra/libsql@1.27.1-alpha.0
  - @mastra/mcp@2.6.0-alpha.1
  - @mastra/memory@1.39.1-alpha.2
  - @mastra/observability@1.21.1-alpha.2
  - @mastra/parallel@0.1.4-alpha.0
  - @mastra/pg@1.33.0-alpha.2
  - @mastra/schema-compat@1.3.17-alpha.0
  - @mastra/stagehand@0.3.7-alpha.1

## 1.15.1-alpha.4

### Patch Changes

- **Kept OpenAI prompt caching working across the steps of a run.** OpenAI requests now send the thread id as `prompt_cache_key`, on both the ChatGPT subscription (Codex) and API-key routes. Codex requests also send it as `session-id` and `thread-id` headers. Before, requests carried no cache key, and all of them start with the same system prompt, so consecutive steps of a run often missed the cache and about half their input was billed uncached. ([#28374](https://github.com/mastra-ai/mastra/pull/28374))

## 1.15.1-alpha.3

### Patch Changes

- Updated dependencies [[`b7ff751`](https://github.com/mastra-ai/mastra/commit/b7ff751ed0fd87a3f93ce438c355c2dcc16e79d5), [`ca04e2c`](https://github.com/mastra-ai/mastra/commit/ca04e2cbb6f5ae13edf006905d9810434b4163fe), [`decd0a0`](https://github.com/mastra-ai/mastra/commit/decd0a0066286996a4558f63e91a8edfa1143feb), [`5bd713b`](https://github.com/mastra-ai/mastra/commit/5bd713b4f2ca7769675d949f8052943807c11598), [`2ca9e35`](https://github.com/mastra-ai/mastra/commit/2ca9e3522f117cc12fee7a9dad2f5961cd41164e), [`a282b3c`](https://github.com/mastra-ai/mastra/commit/a282b3c70cf3b6eefda1216847051aa7bc458a14), [`01e060c`](https://github.com/mastra-ai/mastra/commit/01e060c971237b72d75e05a42edc4a67816028f3), [`2ded35c`](https://github.com/mastra-ai/mastra/commit/2ded35cb0c97b26f641a9eb9a5747d32164d45c9), [`2b9f9a5`](https://github.com/mastra-ai/mastra/commit/2b9f9a55799ee7a6020a063d2419096429254481), [`34ee1d1`](https://github.com/mastra-ai/mastra/commit/34ee1d16226852f57d1f8bb34ee7a88397e5cce2), [`b7ff751`](https://github.com/mastra-ai/mastra/commit/b7ff751ed0fd87a3f93ce438c355c2dcc16e79d5), [`1e31034`](https://github.com/mastra-ai/mastra/commit/1e31034b30cb9661e38af548dfda646aee74f08f), [`fe8c11d`](https://github.com/mastra-ai/mastra/commit/fe8c11d479b7e75bda64f311cadbaf8631782df0)]:
  - @mastra/core@1.80.0-alpha.3
  - @mastra/client-js@1.57.0-alpha.3
  - @mastra/memory@1.39.1-alpha.1

## 1.15.1-alpha.2

### Patch Changes

- Updated dependencies [[`7662736`](https://github.com/mastra-ai/mastra/commit/7662736615043b8f4d0d2e7277094936ff2c88d6)]:
  - @mastra/core@1.80.0-alpha.2
  - @mastra/client-js@1.57.0-alpha.2

## 1.15.1-alpha.1

### Patch Changes

- The missing provider credential error now names the model that needed the credential, so you can tell which setting asked for the provider. For example: `No usable anthropic credential is available for anthropic/claude-haiku-5-5.` ([#28179](https://github.com/mastra-ai/mastra/pull/28179))

- Updated dependencies [[`f396b43`](https://github.com/mastra-ai/mastra/commit/f396b435c72042fc6d9e82c361fa047675995812), [`f396b43`](https://github.com/mastra-ai/mastra/commit/f396b435c72042fc6d9e82c361fa047675995812), [`0d7d5cb`](https://github.com/mastra-ai/mastra/commit/0d7d5cbdccacc0b03697b3400579ea520e382061), [`f5ebbf3`](https://github.com/mastra-ai/mastra/commit/f5ebbf3b2dc935b8fc068996b4db478815f05bd5), [`af1c9a5`](https://github.com/mastra-ai/mastra/commit/af1c9a50864486e548bca0494bc38e336d15481a), [`11c83d5`](https://github.com/mastra-ai/mastra/commit/11c83d53331588e06623d5d4a35baa606bbaa424), [`0d7d5cb`](https://github.com/mastra-ai/mastra/commit/0d7d5cbdccacc0b03697b3400579ea520e382061), [`11c83d5`](https://github.com/mastra-ai/mastra/commit/11c83d53331588e06623d5d4a35baa606bbaa424), [`703b0a1`](https://github.com/mastra-ai/mastra/commit/703b0a1cb342d3a6fce72b5b07685fbb31695674), [`0d7d5cb`](https://github.com/mastra-ai/mastra/commit/0d7d5cbdccacc0b03697b3400579ea520e382061), [`1283717`](https://github.com/mastra-ai/mastra/commit/1283717ecfc652da293aafe6ff582afa07ca84a5), [`4bd8079`](https://github.com/mastra-ai/mastra/commit/4bd80797e4bb6638afb4d374a1caed42c7888913), [`3be96ae`](https://github.com/mastra-ai/mastra/commit/3be96ae2f65a2ff3b2189fb79fd03b7eedee3dbe), [`9db652b`](https://github.com/mastra-ai/mastra/commit/9db652b3264ffad1dc30ef0d451105316c51864d)]:
  - @mastra/client-js@1.57.0-alpha.1
  - @mastra/core@1.80.0-alpha.1
  - @mastra/fastembed@1.3.5-alpha.1
  - @mastra/pg@1.33.0-alpha.1
  - @mastra/observability@1.21.1-alpha.1
  - @mastra/libsql@1.27.0
  - @mastra/mcp@2.6.0-alpha.0

## 1.15.1-alpha.0

### Patch Changes

- dependencies updates: ([#28006](https://github.com/mastra-ai/mastra/pull/28006))
  - Updated dependency [`vscode-languageserver-protocol@^3.18.4` ↗︎](https://www.npmjs.com/package/vscode-languageserver-protocol/v/3.18.4) (from `^3.17.5`, in `dependencies`)

- Use `claude-sonnet-5-5` for Claude Max calls without a model ID, replacing the retired `claude-sonnet-4-20250514` default. ([#28094](https://github.com/mastra-ai/mastra/pull/28094))

- Restored the per-module `dist` layout so every source module is published as its own file again. ([#28139](https://github.com/mastra-ai/mastra/pull/28139))

- Fixed notifications failing with "No model available: this run started without a controller session context" when several Mastra Code processes share one database and one of them was created with its own `pubsub`. That process no longer wakes a thread for a resource none of its sessions serve. It leaves the notification pending, without counting a delivery attempt, for the process that serves the resource. ([#28031](https://github.com/mastra-ai/mastra/pull/28031))

- Fixed a notification sent from one Mastra Code process to a thread that another process on the same resource runs. The sending process woke the thread itself, without a session for it. The run then failed with "No model available", or, when a session in the sender could resolve a model, ran the thread there with the sender's workspace and tools. The notification now waits for the process that runs the thread to deliver it, unless the sender routed it to the thread's claimed owner. ([#28066](https://github.com/mastra-ai/mastra/pull/28066))

- Updated dependencies [[`a15ea70`](https://github.com/mastra-ai/mastra/commit/a15ea70e71ca57242fa61b23e7f0178d77f9af4b), [`a15ea70`](https://github.com/mastra-ai/mastra/commit/a15ea70e71ca57242fa61b23e7f0178d77f9af4b), [`1812ec9`](https://github.com/mastra-ai/mastra/commit/1812ec9fa79050a64d68a77502f50f16d6fc764b), [`c253e13`](https://github.com/mastra-ai/mastra/commit/c253e13ac627d0325f8665004f7af8a49805a9a4), [`c253e13`](https://github.com/mastra-ai/mastra/commit/c253e13ac627d0325f8665004f7af8a49805a9a4), [`c8f8e41`](https://github.com/mastra-ai/mastra/commit/c8f8e410d39a29b8b69cb7bf90cc9a774cb956f5), [`08640de`](https://github.com/mastra-ai/mastra/commit/08640de350ff9183c1d9ef568fde4c6ccdf181e4), [`a1e248b`](https://github.com/mastra-ai/mastra/commit/a1e248bfe0776ab6ca2a55fed3c423b08fb5ae03), [`0afde2c`](https://github.com/mastra-ai/mastra/commit/0afde2c114aa02b0186ae963c8c83796f8801b60), [`a5a9179`](https://github.com/mastra-ai/mastra/commit/a5a9179daa5ac1ed49447265038208c9f96cd0f8), [`8e1247c`](https://github.com/mastra-ai/mastra/commit/8e1247cb26fc1a3cd1c2ac6edaf34fddad897852), [`ed76bdc`](https://github.com/mastra-ai/mastra/commit/ed76bdcc88e09c0f7f0da14ffadca62b1b4a2409), [`9e347d9`](https://github.com/mastra-ai/mastra/commit/9e347d9af9be4451b1a2ca4546a1ad02985f86d5), [`2f655e5`](https://github.com/mastra-ai/mastra/commit/2f655e53fcae10a2423e0194a113ce52e70580fe), [`be5c929`](https://github.com/mastra-ai/mastra/commit/be5c9292ac6d4beb7f1020d0dc745edd18842f3d), [`e39aa42`](https://github.com/mastra-ai/mastra/commit/e39aa4237c81a2eb546a899c9739c96d6359737f), [`e20bbd0`](https://github.com/mastra-ai/mastra/commit/e20bbd0ef40475bda611ddfd8ea2721ddac3642c), [`c9ff73d`](https://github.com/mastra-ai/mastra/commit/c9ff73dd24e9473cb0008857105367c99ba839cb), [`7d58088`](https://github.com/mastra-ai/mastra/commit/7d580884fbf1fb5d90e0761272e2480ed01da70f), [`eee965a`](https://github.com/mastra-ai/mastra/commit/eee965a20dce8ef985cedcdc1fcd842ff85b8c78), [`7440347`](https://github.com/mastra-ai/mastra/commit/744034735aeb7de86ee4409ffa55939978528750), [`db2a1a6`](https://github.com/mastra-ai/mastra/commit/db2a1a659ecb057ae9ff6798a501ed33dd38b7c7), [`b3ea314`](https://github.com/mastra-ai/mastra/commit/b3ea314a3a6f0ae061b6ae81d4124be66a79a70c), [`6a4a607`](https://github.com/mastra-ai/mastra/commit/6a4a607e710000e46790e20f28c2355af9ca2a05), [`de53c27`](https://github.com/mastra-ai/mastra/commit/de53c27a70dbd0c362384691459648043edbee72), [`015c7db`](https://github.com/mastra-ai/mastra/commit/015c7db2acf5c0e364195831c3de2bcc376474fe), [`d3f5000`](https://github.com/mastra-ai/mastra/commit/d3f500024f7b0c107c3786757b3f5481f029d061), [`8ae87fa`](https://github.com/mastra-ai/mastra/commit/8ae87fadd01daa128086e015473881bf55d6e47b), [`20f40eb`](https://github.com/mastra-ai/mastra/commit/20f40ebf5623b059336f4c3000d47755941b4451), [`35806cb`](https://github.com/mastra-ai/mastra/commit/35806cb9b62dfed212b238d00148341d8b2f68ac), [`2fed0ad`](https://github.com/mastra-ai/mastra/commit/2fed0ad258322811ea7f2107f1121c6d5dee1c59), [`6fea510`](https://github.com/mastra-ai/mastra/commit/6fea51000dfc4f249993a7d3959ad41ca6c422ca), [`9e347d9`](https://github.com/mastra-ai/mastra/commit/9e347d9af9be4451b1a2ca4546a1ad02985f86d5), [`bfce5b6`](https://github.com/mastra-ai/mastra/commit/bfce5b6982dc17a6944484b1ee9b333f6f5023d6), [`95c6e7c`](https://github.com/mastra-ai/mastra/commit/95c6e7caf4929d941f958e3f146b551e25eaeef3), [`2829b0e`](https://github.com/mastra-ai/mastra/commit/2829b0eae687d36c8f864eba4051225ae3b82343), [`e053569`](https://github.com/mastra-ai/mastra/commit/e05356995ee8c807516d8aff836a8363dba7eee6), [`2afea6f`](https://github.com/mastra-ai/mastra/commit/2afea6f00bdb4da7a336be9f8ee79f449ed815a6), [`a9ad47d`](https://github.com/mastra-ai/mastra/commit/a9ad47d8c3186e51142b9c1a3ed1e8e29ade2338), [`cf0ca8b`](https://github.com/mastra-ai/mastra/commit/cf0ca8b55d67a3ccf6ee7835e4dd2addea0c82a8), [`875a657`](https://github.com/mastra-ai/mastra/commit/875a65748d5e03b436bab01d7f9fe782fa2941e7), [`d3e8ec7`](https://github.com/mastra-ai/mastra/commit/d3e8ec74e90bedefc28414e459ec9c5d52c97ccc), [`d58fe2a`](https://github.com/mastra-ai/mastra/commit/d58fe2ac5cd64a96dca05657f07df18f23db14e1), [`12f5050`](https://github.com/mastra-ai/mastra/commit/12f5050847cd7cfcf258242745105387c07c803a), [`bd508a2`](https://github.com/mastra-ai/mastra/commit/bd508a2dec8c550baec245bfffc2d0853386e2eb), [`578cb67`](https://github.com/mastra-ai/mastra/commit/578cb670bd8621538eda4afc1f25139e5903aab9), [`2ac8cf1`](https://github.com/mastra-ai/mastra/commit/2ac8cf1435ba3abae9dba7b6c34f1c02f75eab21), [`875a657`](https://github.com/mastra-ai/mastra/commit/875a65748d5e03b436bab01d7f9fe782fa2941e7), [`307b711`](https://github.com/mastra-ai/mastra/commit/307b711bbe73132f1f319c3326333d49bc23b79d), [`dc10589`](https://github.com/mastra-ai/mastra/commit/dc1058900dd9be01638d43491ddfd2037da12bac), [`339da0b`](https://github.com/mastra-ai/mastra/commit/339da0bef7e2e5570f533f6b41abbd746190bffb), [`8c61247`](https://github.com/mastra-ai/mastra/commit/8c6124708341d699c3b1f3bb19f19be468923483), [`5c56910`](https://github.com/mastra-ai/mastra/commit/5c56910b2647e11cbb6880431e556471b25ba949), [`66da6af`](https://github.com/mastra-ai/mastra/commit/66da6af573224af3daeb8767cddbd6112ad2c5e4), [`461ee61`](https://github.com/mastra-ai/mastra/commit/461ee61237cd83e89e120fc5ee7e98eb30e1587a), [`17444a7`](https://github.com/mastra-ai/mastra/commit/17444a7e46b656b3877faad6e61d5637f435b291), [`f3bc1ca`](https://github.com/mastra-ai/mastra/commit/f3bc1caddb161453f8e2636fd0fc96d9b60e2719), [`f156ad0`](https://github.com/mastra-ai/mastra/commit/f156ad0b7ed6b0ba286efd9040c061c9240d55c3), [`af421c6`](https://github.com/mastra-ai/mastra/commit/af421c6b99da3f0fa883602c2544c1291879a8e7)]:
  - @mastra/core@1.80.0-alpha.0
  - @mastra/mcp@2.6.0-alpha.0
  - @mastra/stagehand@0.3.7-alpha.0
  - @mastra/observability@1.21.1-alpha.0
  - @mastra/duckdb@1.16.0-alpha.0
  - @mastra/fastembed@1.3.5-alpha.0
  - @mastra/pg@1.33.0-alpha.0
  - @mastra/client-js@1.57.0-alpha.0
  - @mastra/memory@1.39.1-alpha.0
  - @mastra/libsql@1.27.0

## 1.15.0

### Minor Changes

- Added an `outputProcessors` option to `createMastraCode`. Output processors you pass run after Mastra Code's built-in ones and before memory saves the reply, so changes they make to response messages are persisted. ([#27162](https://github.com/mastra-ai/mastra/pull/27162))

  ```ts
  const mastraCode = await createMastraCode({
    outputProcessors: ({ requestContext }) => [new ReplyLabelProcessor(requestContext)],
  });
  ```

- Added a Factory client for driving a remote Factory session. `RemoteSession` and `RemoteController` mirror a Factory session's state over its event stream and forward messages, approvals, and mode/model switches over HTTP. Platform helpers sign in to Mastra Platform and discover the organizations, projects, and environments to connect to. ([#27222](https://github.com/mastra-ai/mastra/pull/27222))

  ```ts
  import { createFactoryClient } from '@mastra/code-sdk/factory/client';
  import { RemoteSession } from '@mastra/code-sdk/factory/remote-session';
  import { getPlatformSession } from '@mastra/code-sdk/platform/index';

  const session = await getPlatformSession();
  const client = createFactoryClient({ url: 'https://my-factory.factory.mastra.cloud', session });
  ```

  Requests that fail with an expired Platform token refresh it once and retry.

- `SandboxFilesystem` now uses the sandbox's native `filesystem` when it has one. File reads, writes, stats, and listings take one request instead of two or three shell commands, and every file operation goes through it. `grep` and file walks still run as shell commands. Paths with `..` are still rejected. ([#27859](https://github.com/mastra-ai/mastra/pull/27859))

  On the native path, the in-sandbox symlink check is skipped by default, since an agent with a shell can read any file anyway. Set `verifySymlinks: true` when you serve files to people who can't run commands; each path is then checked once per instance:

  ```ts
  const fs = new SandboxFilesystem({ sandbox, workdir: '/workspace/repo', verifySymlinks: true });
  ```

- Added `resolveDefaultThinkingLevel` so a host can supply the thinking level for requests whose session has not picked one. When set, it replaces the settings.json defaults; a session's own level still wins. It runs on every model resolution, including account-rotation hops, so a changed default applies to the next request. ([#27216](https://github.com/mastra-ai/mastra/pull/27216))

  ```ts
  const { controller } = await createMastraCodeAgentController({
    resolveDefaultThinkingLevel: async ({ requestContext }) => lookUpTeamThinkingLevel(requestContext),
  });
  ```

### Patch Changes

- dependencies updates: ([#27728](https://github.com/mastra-ai/mastra/pull/27728))
  - Updated dependency [`@ai-sdk/amazon-bedrock@^3.0.140` ↗︎](https://www.npmjs.com/package/@ai-sdk/amazon-bedrock/v/3.0.140) (from `^3.0.111`, in `dependencies`)
  - Updated dependency [`@ai-sdk/anthropic@^3.0.133` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/3.0.133) (from `^3.0.103`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai@^3.0.130` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai/v/3.0.130) (from `^3.0.88`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai-compatible@^2.0.85` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai-compatible/v/2.0.85) (from `^2.0.62`, in `dependencies`)
  - Updated dependency [`ai@^6.0.309` ↗︎](https://www.npmjs.com/package/ai/v/6.0.309) (from `^6.0.236`, in `dependencies`)

- Fixed ACP turns that an internal error ended returning `stopReason: "cancelled"` when the client never cancelled. `session/prompt` now returns a JSON-RPC error with the underlying message, so clients can tell a failure apart from a cancel. ([#27438](https://github.com/mastra-ai/mastra/pull/27438))

- Background task completions and notification wake-ups now find their session by session id, so they keep reaching the right session when several sessions share one resource. ([#27336](https://github.com/mastra-ai/mastra/pull/27336))

- Fixed the local trace store (`observability.duckdb`, used when `/observability local on`) growing without limit. Each session now deletes traces, logs and metrics older than 14 days and scores and feedback older than 30 days in the background, capped per session so startup is never blocked. ([#27506](https://github.com/mastra-ai/mastra/pull/27506))

- Fixed sandbox workspace search staying on the slow fallback for the whole session when its first search ran before the sandbox was ready. A failed search-tool check is now retried on the next search. ([#27695](https://github.com/mastra-ai/mastra/pull/27695))

- Credential resolution failures (for example a run with no signed-in user) are now logged as errors through the Mastra instance's logger, so they appear in deployed logs. The missing-user error also includes the session and thread ids and the names of the request context entries, so the code path that started the run can be identified. ([#27376](https://github.com/mastra-ai/mastra/pull/27376))

- Factory sessions now always use thread-scoped observational memory. Each run and chat keeps its own observations, and recall search still reaches every thread under the Factory or user resource. Session state, the `MASTRA_OM_SCOPE` environment variable, and `.mastracode/database.json` no longer change the scope for Factory sessions. Mastra Code outside Factory resolves the scope as before. ([#27337](https://github.com/mastra-ai/mastra/pull/27337))

- Fixed notifications for the thread you have open being treated as belonging to another project when the thread's recorded project path differs from the current checkout. Such notifications now run in your session instead of failing with "No model available". If a Mastra Code process for the thread's own project is also running, only one of the two delivers each notification. ([#27634](https://github.com/mastra-ai/mastra/pull/27634))

- Fixed "build a workflow" requests never finishing in Mastra Code. The workflow builder no longer inherits the chat session's memory thread, so it stops waiting on the session run that is waiting on it. ([#27323](https://github.com/mastra-ai/mastra/pull/27323))

- Added `normalizeLegacyProviderId` to `@mastra/code-sdk/providers/model-ids`. It maps a provider id Mastra Code once defined itself to the catalog id models.dev uses, so a reply's provider can be matched against the catalog. ([#27162](https://github.com/mastra-ai/mastra/pull/27162))

  ```ts
  import { normalizeLegacyProviderId } from '@mastra/code-sdk/providers/model-ids';

  normalizeLegacyProviderId('kimi-for-coding'); // 'kimi-code-plan-cn'
  normalizeLegacyProviderId('anthropic'); // 'anthropic'
  ```

- Fixed headless `--output jsonl` runs writing gigabytes of repeated data. The stream included a `display_state_changed` event after almost every other event, and each one carried a full copy of the session's display state, including every large tool result and all shell output so far. Long runs could fill the disk. ([#26881](https://github.com/mastra-ai/mastra/pull/26881))

  `--output jsonl` no longer writes `display_state_changed` events. Every other event, and the final `result` line, is written as before. The omitted snapshots only repeated what the other events already carry. Consumers that rebuilt UI state from these snapshots should fold the remaining events instead. `--output json`, `--output human`, and programmatic `runMC()` iteration are unchanged.

- Fixed a `prune() failed for domain "observability"` error being logged the first time local tracing opened a new `observability.duckdb` file. Mastra Code now skips the startup prune until the trace tables exist; the next session prunes as usual. ([#27517](https://github.com/mastra-ai/mastra/pull/27517))

- Auto memory now picks Gemini only when Mastra Code can use a Google credential for the request: a stored key or sign-in, or locally a `GOOGLE_GENERATIVE_AI_API_KEY` or `GOOGLE_API_KEY` environment variable. Deployed Factory accounts never use the server's environment keys, so they get a model from a provider they connected. ([#26666](https://github.com/mastra-ai/mastra/pull/26666))

- `/om` now shows the same Auto memory model that runs use. Before, the preview only checked `GOOGLE_GENERATIVE_AI_API_KEY`, so with `GOOGLE_API_KEY` or a Google key saved with `mastracode login` it showed Claude Haiku while runs used Gemini Flash. ([#27449](https://github.com/mastra-ai/mastra/pull/27449))

- Fixed foreground commands in Mastra Code to stop after 30 seconds unless the command specifies a timeout. Set timeout to 0 to disable the limit. Background processes are unaffected. ([#26878](https://github.com/mastra-ai/mastra/pull/26878))

- Improved content search in sandbox workspaces without ripgrep. When the sandbox's GNU grep and git support PCRE, patterns run with `grep -P` and `git grep -P`, so `\d`, `\w`, `\s`, `\b`, and lookarounds are searched in one command instead of falling back to reading files one by one. ([#27698](https://github.com/mastra-ai/mastra/pull/27698))

- Fixed headless runs reporting success while a tool was still waiting for an answer. When a tool such as `request_access` paused the run, `runMC` stopped with `status: 'completed'` and exit code `0`, so the answer from the permission policy was never applied. Headless runs now wait for the paused run to stop, send the policy's answer, and keep running until the resumed run finishes. If a paused tool can't be resumed, the run ends with `status: 'error'` and exit code `1` instead of reporting success. ([#26883](https://github.com/mastra-ai/mastra/pull/26883))

- Fixed headless runs cutting off their output when stdout is a pipe. The CLI exited before Node finished writing, so a large final result could reach the reader incomplete while the process still exited with code 0. Headless mode now waits for stdout and stderr to flush before exiting. If the output can't be delivered because the reader closed the pipe, a run that would otherwise succeed exits with code 1 instead of 0. A run that already failed keeps its exit code. ([#26880](https://github.com/mastra-ai/mastra/pull/26880))

- Improved sandbox grep reliability and diagnostics. When `rg` or `grep` fails inside the sandbox, the error now says why, for example a timeout or an exit code with the first stderr line. Previously every failure was reported as an unsupported pattern. The POSIX `grep` fallback now skips `.git`, and it keeps matches when only some files could not be read. ([#27464](https://github.com/mastra-ai/mastra/pull/27464))

- Scheduled prompts that fire into a session no longer held live in this process now run as that session's owner. Hosts that resume sessions (`resumeWakeSession`) bring the owner's session back first; if no owner can be found, the fire fails with `No session owns resource … to run its wake on thread …` before any run starts, instead of starting a run with no signed-in user that failed with "Tenant model credential policy could not be resolved: the request has no authenticated user." Only hosts with schedule tools enabled are affected. ([#27780](https://github.com/mastra-ai/mastra/pull/27780))

- Made content search in sandbox workspaces much faster when ripgrep isn't installed. Searches now run as a single GNU grep command with context lines, using git to respect every repository's `.gitignore`, instead of reading files one by one. With ripgrep, searches also respect `.gitignore` files now. Both skip `node_modules` unless the search path points inside it. File listings in sandbox workspaces also skip `node_modules` inside the sandbox instead of returning it to be filtered out. ([#27687](https://github.com/mastra-ai/mastra/pull/27687))

- Bump for npm ([#27221](https://github.com/mastra-ai/mastra/pull/27221))

- Fixed the cross-agent signal sender telling the model to resend a signal that failed direct delivery. The signal waits in the recipient's inbox and is retried automatically, so the sender now tells the model not to resend it. A resend while that signal is still pending merges into it; a resend after it is delivered sends the recipient a second copy. ([#27347](https://github.com/mastra-ai/mastra/pull/27347))

- Added Extra high thinking to xAI models that list it, such as Grok 4.6. ([#26530](https://github.com/mastra-ai/mastra/pull/26530))

  ```ts
  import { getModelReasoningOptions } from '@mastra/core/llm';
  import { getAvailableThinkingLevelsForModel } from '@mastra/code-sdk/thinking';

  getAvailableThinkingLevelsForModel('xai/grok-4.6', getModelReasoningOptions('xai/grok-4.6'));
  // ['off', 'low', 'medium', 'high', 'xhigh']
  ```

- Mastra Code sessions no longer load web search providers, the Postgres store, the local trace store (DuckDB), the MCP client, local embeddings or voice SDKs until a feature needs them, which cuts startup memory by about 90 MB. ([#27680](https://github.com/mastra-ai/mastra/pull/27680))

- Added a `resumeWakeSession` option to `createMastraCode`. It runs when a notification is due on a thread whose session isn't open in this process, so the host can bring that session back online as its owner before the wake runs. If no session owns the thread afterwards, or the hook throws, the delivery fails with that error instead of waking with no user. ([#27729](https://github.com/mastra-ai/mastra/pull/27729))

  Pair it with `prepareWakeRequestContext`, which attaches the owner's identity to the wake itself:

  ```ts
  const code = await createMastraCode({
    resumeWakeSession: async ({ resourceId, threadId }) => {
      const owner = await lookupSessionOwner(resourceId);
      if (!owner) throw new Error(`Session ${resourceId} has no known owner`);
      const requestContext = new RequestContext([['user', owner]]);
      await code.controller.createSession({ id: resourceId, resourceId, ownerId: owner.id, threadId, requestContext });
    },
    prepareWakeRequestContext: async ({ requestContext, resourceId }) => {
      requestContext.set('user', await lookupSessionOwner(resourceId));
    },
  });
  ```

- Fixed woken notifications running in the wrong project when Mastra Code processes in different directories share one resource id. A due notification now runs as the session whose project the thread belongs to, and is delivered by a process running in that project: each project gets its own notification dispatch turn on the shared resource, so a process no longer runs another project's thread with its own workspace and tools, and no longer leaves it waiting until the process holding the resource exits. ([#27426](https://github.com/mastra-ai/mastra/pull/27426))

- Updated dependencies [[`dbde4bf`](https://github.com/mastra-ai/mastra/commit/dbde4bf36ac016abcda61868cc6f792f9d07abee), [`8bbf696`](https://github.com/mastra-ai/mastra/commit/8bbf69693321c3308f85276a5bdfc2469b40dd8e), [`8bbf696`](https://github.com/mastra-ai/mastra/commit/8bbf69693321c3308f85276a5bdfc2469b40dd8e), [`3af753f`](https://github.com/mastra-ai/mastra/commit/3af753fb40a2b8f7ab17b1cf16cd4da7e1b020a6), [`ec84d93`](https://github.com/mastra-ai/mastra/commit/ec84d93cda24d56a0812086fcaace9e68ce8e089), [`6362d32`](https://github.com/mastra-ai/mastra/commit/6362d32a905d32820dcab3b9a039ebc1cec4f444), [`6362d32`](https://github.com/mastra-ai/mastra/commit/6362d32a905d32820dcab3b9a039ebc1cec4f444), [`1c9fd9b`](https://github.com/mastra-ai/mastra/commit/1c9fd9bbdd4258c0d86c89cac6ae68c5023a2590), [`59c02f5`](https://github.com/mastra-ai/mastra/commit/59c02f53955dde397f343f2107060ed70bbe63c5), [`e3678a5`](https://github.com/mastra-ai/mastra/commit/e3678a564cf3bb5922112b4dca65973c5fdc0a92), [`934ec13`](https://github.com/mastra-ai/mastra/commit/934ec1315e8ee4b73067864f56a9fcc8105e8512), [`ad77770`](https://github.com/mastra-ai/mastra/commit/ad777701b62651f8bef64abfc4ea91cef0cd6ac3), [`9b60f12`](https://github.com/mastra-ai/mastra/commit/9b60f12b13b28c9664a839aef435e6d10898644d), [`9b60f12`](https://github.com/mastra-ai/mastra/commit/9b60f12b13b28c9664a839aef435e6d10898644d), [`14f17b8`](https://github.com/mastra-ai/mastra/commit/14f17b86e2b162623bb22942c7930c2113a6d8a1), [`9c4d65f`](https://github.com/mastra-ai/mastra/commit/9c4d65f41ee21e407f0015b0e745881288f69d05), [`48bee02`](https://github.com/mastra-ai/mastra/commit/48bee02e1a5cef20f4da67720191d5e85cdca13c), [`f885386`](https://github.com/mastra-ai/mastra/commit/f885386b79be0e4d784067b0e26608971e0cc788), [`915fbe6`](https://github.com/mastra-ai/mastra/commit/915fbe67e974edbeba4dbd3afeaec4d68b34b118), [`9b546e2`](https://github.com/mastra-ai/mastra/commit/9b546e2b9dba91d51769a73ce1a0b34d775b144a), [`f1b596e`](https://github.com/mastra-ai/mastra/commit/f1b596e3219bd8721079611c62b92b8f0f6c12d9), [`d93662b`](https://github.com/mastra-ai/mastra/commit/d93662bfee9313c376cff90e910e05ec9b0634ea), [`871f3c8`](https://github.com/mastra-ai/mastra/commit/871f3c801640148cffa09474fc9f9032495ddccf), [`44e35e4`](https://github.com/mastra-ai/mastra/commit/44e35e47491ad5fd9f771526d5d8c312644000ec), [`336692a`](https://github.com/mastra-ai/mastra/commit/336692a646e28d24b303eefdb8fdbe64e4b4e801), [`41b7f34`](https://github.com/mastra-ai/mastra/commit/41b7f3422a97f1385a285002b7e6f898eb5c7b06), [`871f3c8`](https://github.com/mastra-ai/mastra/commit/871f3c801640148cffa09474fc9f9032495ddccf), [`f1c68eb`](https://github.com/mastra-ai/mastra/commit/f1c68eb4ae080d8cbbc694ae580850d8fa94dece), [`97f78c3`](https://github.com/mastra-ai/mastra/commit/97f78c3cf104600887e08e94cc073c973bb53c3b), [`e13dddd`](https://github.com/mastra-ai/mastra/commit/e13dddd4f5ac10448cd37009c31efedbf4c40ff4), [`9c66073`](https://github.com/mastra-ai/mastra/commit/9c66073db33749ab622d54db7e8885f183451ca4), [`6bfe708`](https://github.com/mastra-ai/mastra/commit/6bfe7087fcc27a08c8cba95a45c5da353188bb9c), [`3624981`](https://github.com/mastra-ai/mastra/commit/36249818e7cd0b2904142c6b133cc1ceb756ba68), [`aaedaa6`](https://github.com/mastra-ai/mastra/commit/aaedaa634aa7394789952d4f9fe04b1aec8619a1), [`a92384b`](https://github.com/mastra-ai/mastra/commit/a92384bf9093beb9071953292a936ca722370ce5), [`c56d026`](https://github.com/mastra-ai/mastra/commit/c56d026c5194b1977e5321f429565eedbccf2c40), [`a8f9157`](https://github.com/mastra-ai/mastra/commit/a8f9157fafe38f5acf68e37c8874ebd192ef8e10), [`79fd3b0`](https://github.com/mastra-ai/mastra/commit/79fd3b06a7cf59f7acb4591b9ba0f388d548fd17), [`04ded0b`](https://github.com/mastra-ai/mastra/commit/04ded0b7409b39008a1e4611c412ee80ee20993d), [`5d8f8b7`](https://github.com/mastra-ai/mastra/commit/5d8f8b78460350d581e8a92412cdfe88b4ce76bc), [`f28b72f`](https://github.com/mastra-ai/mastra/commit/f28b72f255a460746f08c73b2a1d336bfc57757b), [`90dca88`](https://github.com/mastra-ai/mastra/commit/90dca88f44f31428a0e585584114b56f0bec477b), [`1874bf2`](https://github.com/mastra-ai/mastra/commit/1874bf2a5ba304f22ffb93f9ec5a9afea000a5a1), [`4e6701a`](https://github.com/mastra-ai/mastra/commit/4e6701a8534e29fad29c7fe4c6787dc1ed56b419), [`a3f8ac0`](https://github.com/mastra-ai/mastra/commit/a3f8ac03c7526248e585f3e4e87b349566dd4797), [`022e6cf`](https://github.com/mastra-ai/mastra/commit/022e6cf06fdc891a6318f16db304be8fe75b7f72), [`d8fb857`](https://github.com/mastra-ai/mastra/commit/d8fb857bda2c23a08e535291a638fbc6e3a4e073), [`6c67158`](https://github.com/mastra-ai/mastra/commit/6c67158a10406adae195887167862d632bb54d64), [`26e684b`](https://github.com/mastra-ai/mastra/commit/26e684b1f152d341c2dca01c5347fea7e8762188), [`d8bfd3d`](https://github.com/mastra-ai/mastra/commit/d8bfd3d502dd9952db66f0c4f53cd04f5c8e71ef), [`ace1e35`](https://github.com/mastra-ai/mastra/commit/ace1e35d5762f96976a2cba958283edda71fcc3b), [`f905746`](https://github.com/mastra-ai/mastra/commit/f905746159def2d386dca516657123f43ef90e24), [`b77f59c`](https://github.com/mastra-ai/mastra/commit/b77f59cc5407b1158a271d579b55514f2ba79145), [`776bb6e`](https://github.com/mastra-ai/mastra/commit/776bb6e2b3ed9ec32e5430332ee756185fcebb68), [`2d0a3b0`](https://github.com/mastra-ai/mastra/commit/2d0a3b06d0880036c0dbd4b1fcf782d1f5115a56), [`ad8e752`](https://github.com/mastra-ai/mastra/commit/ad8e75217bcbb12986e7e77a30cb4af1be93c0fd), [`ba744e5`](https://github.com/mastra-ai/mastra/commit/ba744e5347d7d373b89233f1b8beddb5bdf5b2c3), [`4471372`](https://github.com/mastra-ai/mastra/commit/4471372b0338523a2f57407a90b1d913e68f17cc), [`5131dad`](https://github.com/mastra-ai/mastra/commit/5131dadf8c2db8641030111203db6c16fe3240f2), [`58db748`](https://github.com/mastra-ai/mastra/commit/58db74858beae6ff20ff22786c968386b9d3edcc), [`8c2d516`](https://github.com/mastra-ai/mastra/commit/8c2d5164714a27e720d898da612da6054a88ef91), [`7425858`](https://github.com/mastra-ai/mastra/commit/74258589417e9e91114c64571a67702d2e352b3f), [`0e9a577`](https://github.com/mastra-ai/mastra/commit/0e9a5774151385c93524883e2b1bea40e2a644de), [`b69dcad`](https://github.com/mastra-ai/mastra/commit/b69dcadb02a2630755a859bd4454c1b133e565ce), [`0f337be`](https://github.com/mastra-ai/mastra/commit/0f337be51ebddbe1cf388e926155b737538de1db), [`6eeb344`](https://github.com/mastra-ai/mastra/commit/6eeb34446435ff7b446ced421ffae9951d4cc733), [`80b382d`](https://github.com/mastra-ai/mastra/commit/80b382d183d60ee39f276d1033552575966d5ddd), [`fd98055`](https://github.com/mastra-ai/mastra/commit/fd98055302882876b8dc5ae03649a89a72e2ac6c), [`b2c91db`](https://github.com/mastra-ai/mastra/commit/b2c91dbd2d32e18cd114d87301fc3b8182fddb10), [`c111a5b`](https://github.com/mastra-ai/mastra/commit/c111a5bfa2a7a197f30700ce238c84ee799df140), [`a97ba85`](https://github.com/mastra-ai/mastra/commit/a97ba8578a2dc91a16d945276ca8c7a4ad32e38a), [`f6a9762`](https://github.com/mastra-ai/mastra/commit/f6a9762b12ae9dad6a154f73ed3099a2ee472d0c), [`fa5a031`](https://github.com/mastra-ai/mastra/commit/fa5a0316dbd5f68316b48c426fd904d2d80d9045), [`14b2a7c`](https://github.com/mastra-ai/mastra/commit/14b2a7c56da4329f7fd17738056a081663deed46), [`750a4ed`](https://github.com/mastra-ai/mastra/commit/750a4edf7826da9ba7321682912504c60f29712d), [`e5b6877`](https://github.com/mastra-ai/mastra/commit/e5b6877fbdb471485b99019eb50046b44e778aae), [`c236d64`](https://github.com/mastra-ai/mastra/commit/c236d64974c68e6c0f9bf6e3d6442e0184c5f49e), [`fc96794`](https://github.com/mastra-ai/mastra/commit/fc9679466bede4ca3e014aea48a72fd950a13d2a), [`e5b6877`](https://github.com/mastra-ai/mastra/commit/e5b6877fbdb471485b99019eb50046b44e778aae), [`85a26af`](https://github.com/mastra-ai/mastra/commit/85a26af75fe62b7f2d8ac0b56d322798e5ae0616), [`5758ba0`](https://github.com/mastra-ai/mastra/commit/5758ba045b01c407a7414b32dbbdf5480596b31d), [`8271439`](https://github.com/mastra-ai/mastra/commit/8271439b491f5f777590abfda9a0ac7f1e3212c2), [`44e35e4`](https://github.com/mastra-ai/mastra/commit/44e35e47491ad5fd9f771526d5d8c312644000ec), [`7337dac`](https://github.com/mastra-ai/mastra/commit/7337dac8aad8d70e98a4b0c7caa677c01966b53b), [`fc96794`](https://github.com/mastra-ai/mastra/commit/fc9679466bede4ca3e014aea48a72fd950a13d2a), [`f51c0af`](https://github.com/mastra-ai/mastra/commit/f51c0afdd1b181b84e294f8613185494a8aaec3c), [`5f70db1`](https://github.com/mastra-ai/mastra/commit/5f70db1f3b5b38a27438d1c153db352d2bc8de30), [`179964b`](https://github.com/mastra-ai/mastra/commit/179964b95aacac31763a4a1aa2f2d1c652aa529d), [`3012dd4`](https://github.com/mastra-ai/mastra/commit/3012dd424b2329eda78381688f1f48244173e6a2), [`7afee18`](https://github.com/mastra-ai/mastra/commit/7afee18a3d91ce125f08ffd6e2724695e8a68652), [`ca1b2f2`](https://github.com/mastra-ai/mastra/commit/ca1b2f25d7c69c6e90b719baef32ffb1db6c5681), [`12991bd`](https://github.com/mastra-ai/mastra/commit/12991bd0945ca36e13b213ebcbfaf0880d04d44d), [`2a88e01`](https://github.com/mastra-ai/mastra/commit/2a88e018493abde76930e91df4d947506557ad53), [`0ac6a2a`](https://github.com/mastra-ai/mastra/commit/0ac6a2a4ab19f294b5362bcdf9c8ae9e3d8a3ede), [`76d0af2`](https://github.com/mastra-ai/mastra/commit/76d0af2b0013147f6043d9fc44c44278065240e7), [`a74f28c`](https://github.com/mastra-ai/mastra/commit/a74f28cca56118bf5f7d3354a5e991508f927dbc), [`b8fe2ae`](https://github.com/mastra-ai/mastra/commit/b8fe2aec651efeaad6d607d816565453a341cdef), [`22df9d7`](https://github.com/mastra-ai/mastra/commit/22df9d76651b3b4d513388a7eae8e51dbfb36a1b), [`fc96794`](https://github.com/mastra-ai/mastra/commit/fc9679466bede4ca3e014aea48a72fd950a13d2a), [`90dca88`](https://github.com/mastra-ai/mastra/commit/90dca88f44f31428a0e585584114b56f0bec477b), [`6889aa2`](https://github.com/mastra-ai/mastra/commit/6889aa29d661a8892f503e37bc3d8ffe18aa7e37), [`f54f8b2`](https://github.com/mastra-ai/mastra/commit/f54f8b2df2aa24e1ef4d171c733576e7c62bb1b0), [`f54f8b2`](https://github.com/mastra-ai/mastra/commit/f54f8b2df2aa24e1ef4d171c733576e7c62bb1b0), [`f54f8b2`](https://github.com/mastra-ai/mastra/commit/f54f8b2df2aa24e1ef4d171c733576e7c62bb1b0), [`f54f8b2`](https://github.com/mastra-ai/mastra/commit/f54f8b2df2aa24e1ef4d171c733576e7c62bb1b0), [`6309939`](https://github.com/mastra-ai/mastra/commit/63099393563cc177960862c9179c4e2420acac5f), [`f6260f8`](https://github.com/mastra-ai/mastra/commit/f6260f8cc50c21a5d78d47fff4e04e55aca57a08), [`9cb6843`](https://github.com/mastra-ai/mastra/commit/9cb6843a8a39ab2e12498b0c08c9f4cdcefd9cea), [`9b546e2`](https://github.com/mastra-ai/mastra/commit/9b546e2b9dba91d51769a73ce1a0b34d775b144a), [`0971298`](https://github.com/mastra-ai/mastra/commit/0971298317be971ae1c3f0c1d949a31df7d71c7f), [`6362d32`](https://github.com/mastra-ai/mastra/commit/6362d32a905d32820dcab3b9a039ebc1cec4f444), [`a0c031c`](https://github.com/mastra-ai/mastra/commit/a0c031ceb671721b6f8557726e216ee81d23612e), [`72cb1e2`](https://github.com/mastra-ai/mastra/commit/72cb1e2b9453f7bb1bd08e4f9aa54da56fa20600), [`3012dd4`](https://github.com/mastra-ai/mastra/commit/3012dd424b2329eda78381688f1f48244173e6a2), [`a3be51b`](https://github.com/mastra-ai/mastra/commit/a3be51b1a545b45bfb04377699edecbb8a8d79d6), [`bcfb6af`](https://github.com/mastra-ai/mastra/commit/bcfb6af5a61d79f6902e87d3a8fa70283f48705d), [`03868f8`](https://github.com/mastra-ai/mastra/commit/03868f840401865af433040ba7ff90f585dea2e1), [`fc96794`](https://github.com/mastra-ai/mastra/commit/fc9679466bede4ca3e014aea48a72fd950a13d2a), [`1874bf2`](https://github.com/mastra-ai/mastra/commit/1874bf2a5ba304f22ffb93f9ec5a9afea000a5a1), [`a98fe9c`](https://github.com/mastra-ai/mastra/commit/a98fe9c9b115830ee7db787f2c5e7499cceb8979), [`12a8a89`](https://github.com/mastra-ai/mastra/commit/12a8a89938ee5dbad91edb5b4da26cd68c95fabd), [`5035d61`](https://github.com/mastra-ai/mastra/commit/5035d619e9b3369ba9bda264ac0460528012168b), [`368149c`](https://github.com/mastra-ai/mastra/commit/368149c27954f6d578d3561cc1801cb415b78aa7), [`6b8435c`](https://github.com/mastra-ai/mastra/commit/6b8435c1aaad98a3a5218ececbc45107968c9218), [`5b936b6`](https://github.com/mastra-ai/mastra/commit/5b936b65d229865dabba01e49e36c8e19e7b2ebc), [`d0f9cbd`](https://github.com/mastra-ai/mastra/commit/d0f9cbd37681e610e634ca69e3fd8210ac0fc0ef), [`40a76a8`](https://github.com/mastra-ai/mastra/commit/40a76a854d9246aa8b8ba25ab3f58d7542e0ffea), [`0a88b7c`](https://github.com/mastra-ai/mastra/commit/0a88b7c6ec1ba548c67317ffff1169310b8d4b8d), [`fdf475d`](https://github.com/mastra-ai/mastra/commit/fdf475dbc8974e1ae21966e5e96e316a7beebdf7), [`2725bd7`](https://github.com/mastra-ai/mastra/commit/2725bd73fa27f231e30bce7c6a03c651bc15b408), [`9277d8e`](https://github.com/mastra-ai/mastra/commit/9277d8ef26ad2f08bfbae89d78d409fb91c95c8d), [`0611d4a`](https://github.com/mastra-ai/mastra/commit/0611d4a060696da5c3c550b07451d870d4af0f58), [`eb0b702`](https://github.com/mastra-ai/mastra/commit/eb0b702e9939f02073fb1c4dfd7eaa51fde59e0b), [`e41478c`](https://github.com/mastra-ai/mastra/commit/e41478cbb7ab108cf7f704a6f0f4092ec4374e21), [`323b021`](https://github.com/mastra-ai/mastra/commit/323b0212bc57c2b9acaed2716812a873c0fa43ee), [`bdf7dac`](https://github.com/mastra-ai/mastra/commit/bdf7dac468e3f0fdf66d2b2d964f839087e0cb99), [`33ee758`](https://github.com/mastra-ai/mastra/commit/33ee758d6c11991c9ecc356ae1015d18767fcd3a), [`78b3ef7`](https://github.com/mastra-ai/mastra/commit/78b3ef7cb120f2b366a39d7095ece5f0ec7d3f71), [`0eb8311`](https://github.com/mastra-ai/mastra/commit/0eb8311f9ecf254c96179e99dc145d6df3cccd07), [`ba7b0ea`](https://github.com/mastra-ai/mastra/commit/ba7b0eac045755d39d20dcf3a943ea5f8270b009), [`9b546e2`](https://github.com/mastra-ai/mastra/commit/9b546e2b9dba91d51769a73ce1a0b34d775b144a), [`e8d7f8e`](https://github.com/mastra-ai/mastra/commit/e8d7f8e52da32b05f2e8501c1127128ae1a5d450), [`d93662b`](https://github.com/mastra-ai/mastra/commit/d93662bfee9313c376cff90e910e05ec9b0634ea), [`0e5d045`](https://github.com/mastra-ai/mastra/commit/0e5d045be4ab67d1fba5eeb8125bc2ec43aa9519), [`0e4fa4f`](https://github.com/mastra-ai/mastra/commit/0e4fa4f0604bb2e6e63e5d1d203b2dcadd646a81), [`a355b9f`](https://github.com/mastra-ai/mastra/commit/a355b9ff242701de0fdb49f47b1fa39faf89c610), [`6889aa2`](https://github.com/mastra-ai/mastra/commit/6889aa29d661a8892f503e37bc3d8ffe18aa7e37), [`c397dff`](https://github.com/mastra-ai/mastra/commit/c397dff0ee0662b56f348852ad08aff820239d66), [`f96161a`](https://github.com/mastra-ai/mastra/commit/f96161af6355c640738df4b9d3fcdad601f6b6df), [`92ea5c9`](https://github.com/mastra-ai/mastra/commit/92ea5c92eb62e31ce005d1f43072b74d81577715), [`92034fa`](https://github.com/mastra-ai/mastra/commit/92034fa2a46a4f45af416c3201752342ead71d89), [`b2c91db`](https://github.com/mastra-ai/mastra/commit/b2c91dbd2d32e18cd114d87301fc3b8182fddb10), [`e4cd1d1`](https://github.com/mastra-ai/mastra/commit/e4cd1d13de8bcb14d8d0a8531f7b96fcbb138217), [`4e44e7f`](https://github.com/mastra-ai/mastra/commit/4e44e7f518debb3b0aebc5ad71ea3e4a3902d8c9), [`b03ee08`](https://github.com/mastra-ai/mastra/commit/b03ee089c70c087cdc9d1d0a85aa749621ad5a3c), [`0f1d83f`](https://github.com/mastra-ai/mastra/commit/0f1d83fed073613869d6283adb198b934ef80093), [`7aa0361`](https://github.com/mastra-ai/mastra/commit/7aa036142ca476b1f1e18a220f826e73ca58c38a), [`cd864ca`](https://github.com/mastra-ai/mastra/commit/cd864ca5d1fa6cb3477cb8a87b79070febbb3b6b), [`e3678a5`](https://github.com/mastra-ai/mastra/commit/e3678a564cf3bb5922112b4dca65973c5fdc0a92), [`d95a821`](https://github.com/mastra-ai/mastra/commit/d95a821e903f7883b5fadfee5c7f59809d66cfb8), [`d95a821`](https://github.com/mastra-ai/mastra/commit/d95a821e903f7883b5fadfee5c7f59809d66cfb8), [`d95a821`](https://github.com/mastra-ai/mastra/commit/d95a821e903f7883b5fadfee5c7f59809d66cfb8), [`d95a821`](https://github.com/mastra-ai/mastra/commit/d95a821e903f7883b5fadfee5c7f59809d66cfb8), [`98c7e10`](https://github.com/mastra-ai/mastra/commit/98c7e109fca4995d19d7eb132fdb8411c860b151), [`e35e335`](https://github.com/mastra-ai/mastra/commit/e35e335f19ee0c7c1e03bf247aebd24c3e041459), [`e35e335`](https://github.com/mastra-ai/mastra/commit/e35e335f19ee0c7c1e03bf247aebd24c3e041459), [`e3678a5`](https://github.com/mastra-ai/mastra/commit/e3678a564cf3bb5922112b4dca65973c5fdc0a92), [`3c2c033`](https://github.com/mastra-ai/mastra/commit/3c2c033aa68cd8cd7e4c630abd7f1bfeb440f457), [`425d383`](https://github.com/mastra-ai/mastra/commit/425d383d4fb15e55e9491b6bdaebb57f2de7cdc8), [`6889aa2`](https://github.com/mastra-ai/mastra/commit/6889aa29d661a8892f503e37bc3d8ffe18aa7e37), [`5d8f8b7`](https://github.com/mastra-ai/mastra/commit/5d8f8b78460350d581e8a92412cdfe88b4ce76bc), [`5d5ea03`](https://github.com/mastra-ai/mastra/commit/5d5ea032a4c64cefe5bc217f4cc761a9364ccbf4), [`fae54c5`](https://github.com/mastra-ai/mastra/commit/fae54c57917cd1f527937ca42b5ab7dfe1d55a2a), [`d7c012f`](https://github.com/mastra-ai/mastra/commit/d7c012fcc98a18552e0aef55f9c0d19fccad57da), [`b0f7f91`](https://github.com/mastra-ai/mastra/commit/b0f7f91eb667f15e188b861759b4c4a5761ec233), [`958d170`](https://github.com/mastra-ai/mastra/commit/958d170c218a0e050c0c4807a94ce1f67f00e570), [`ba7d4e5`](https://github.com/mastra-ai/mastra/commit/ba7d4e5c9759a164279c7ebdbe2b7a32ae94b4ce), [`8b36444`](https://github.com/mastra-ai/mastra/commit/8b36444dbbc6916d298015c2586fbbde2e9b265f), [`5d8f8b7`](https://github.com/mastra-ai/mastra/commit/5d8f8b78460350d581e8a92412cdfe88b4ce76bc), [`3f68324`](https://github.com/mastra-ai/mastra/commit/3f68324e72f03bbc7d918d23013f550527f59c40), [`bfd35f6`](https://github.com/mastra-ai/mastra/commit/bfd35f64178f06774c95dabec4a796245cf8a401), [`8c90438`](https://github.com/mastra-ai/mastra/commit/8c90438b404d27593927eccc47616aab4a35006e), [`0b5eaa0`](https://github.com/mastra-ai/mastra/commit/0b5eaa07445a6551481ab6ceadef603b020a099b), [`12407df`](https://github.com/mastra-ai/mastra/commit/12407df9e6bd2f82cd27533bd4a9aa8057b97f2e), [`f122808`](https://github.com/mastra-ai/mastra/commit/f1228088b6f60f6c7ef9db8b9aca70bc5cf9f00c), [`8c05e78`](https://github.com/mastra-ai/mastra/commit/8c05e78b099b26daf4bfa9b229190201c8bf581d), [`9620613`](https://github.com/mastra-ai/mastra/commit/96206136bcc184e6238bd6dd5627fe28254eec0b), [`984fd2a`](https://github.com/mastra-ai/mastra/commit/984fd2a2139ee9a8b2cefd331f071210cf524e4d), [`cc977b4`](https://github.com/mastra-ai/mastra/commit/cc977b4ce7def6727cdd63af3478d2b8b83daf07), [`c36b9e7`](https://github.com/mastra-ai/mastra/commit/c36b9e7129b355211ed9e7a3b7df2d7b81c01c05), [`c82558f`](https://github.com/mastra-ai/mastra/commit/c82558f2e5eedb493afff46f940ab7f3c085d57f), [`100431b`](https://github.com/mastra-ai/mastra/commit/100431b965dba5d32d282cfcd3c0415013cc0eed), [`7a0aea2`](https://github.com/mastra-ai/mastra/commit/7a0aea28af3bcf879a75b5bcdbfc3d471f63c565), [`7a0aea2`](https://github.com/mastra-ai/mastra/commit/7a0aea28af3bcf879a75b5bcdbfc3d471f63c565), [`5d8f8b7`](https://github.com/mastra-ai/mastra/commit/5d8f8b78460350d581e8a92412cdfe88b4ce76bc), [`a0471fe`](https://github.com/mastra-ai/mastra/commit/a0471fefaf92a44b44f5fb23e607fdad087e51f2), [`3012dd4`](https://github.com/mastra-ai/mastra/commit/3012dd424b2329eda78381688f1f48244173e6a2), [`e0077c3`](https://github.com/mastra-ai/mastra/commit/e0077c34070037ac77c264a9d5000a69c0dd2095), [`f9e22cc`](https://github.com/mastra-ai/mastra/commit/f9e22cc6fa264ded4a95ab34dab84b6ce12c2597), [`e41478c`](https://github.com/mastra-ai/mastra/commit/e41478cbb7ab108cf7f704a6f0f4092ec4374e21), [`9b546e2`](https://github.com/mastra-ai/mastra/commit/9b546e2b9dba91d51769a73ce1a0b34d775b144a), [`fed802d`](https://github.com/mastra-ai/mastra/commit/fed802d6e4e395d9ba42a1122c2468a072407b1c), [`7704aa1`](https://github.com/mastra-ai/mastra/commit/7704aa18b657ba89ddbf91bf193bb3dfbb56c5f2), [`6889aa2`](https://github.com/mastra-ai/mastra/commit/6889aa29d661a8892f503e37bc3d8ffe18aa7e37), [`bde069a`](https://github.com/mastra-ai/mastra/commit/bde069ac2f610abd5a09bcdb511ed04f5f01437e), [`7f4a1ca`](https://github.com/mastra-ai/mastra/commit/7f4a1ca724829e0a732eea6afb285f15908df8e9), [`d0251e3`](https://github.com/mastra-ai/mastra/commit/d0251e34973492c60e4dc7614116fcf912739875), [`680d914`](https://github.com/mastra-ai/mastra/commit/680d9141c851e8eb6fcd2d3c3fbadf05a0f1011d), [`ae74f81`](https://github.com/mastra-ai/mastra/commit/ae74f812d75034a90d647739062b9c2ca84b4ed6), [`b23b87b`](https://github.com/mastra-ai/mastra/commit/b23b87b8ab849cdc9f58b297d667c0bbaed0b62f), [`8c90438`](https://github.com/mastra-ai/mastra/commit/8c90438b404d27593927eccc47616aab4a35006e), [`f1a5cdc`](https://github.com/mastra-ai/mastra/commit/f1a5cdc2ae5c0cd3edb096bf47672f205f65aefa), [`a7bfa1f`](https://github.com/mastra-ai/mastra/commit/a7bfa1ff7c592f368cf34be472c7d89e03b0098b), [`f42951a`](https://github.com/mastra-ai/mastra/commit/f42951afb1d2c2a2148100a54b6ec10d473c9591), [`c8035a4`](https://github.com/mastra-ai/mastra/commit/c8035a49ae2af692d812dace394ac64635f5fd1d), [`1980959`](https://github.com/mastra-ai/mastra/commit/1980959335396f8ee72558689623abf3e205b31b), [`fa409d4`](https://github.com/mastra-ai/mastra/commit/fa409d430b879e45d433497439c0c11d2a3fafd6), [`0876fa8`](https://github.com/mastra-ai/mastra/commit/0876fa827a9685022fb0dc1606cbb673dffcaf95), [`3012dd4`](https://github.com/mastra-ai/mastra/commit/3012dd424b2329eda78381688f1f48244173e6a2), [`f81d7cb`](https://github.com/mastra-ai/mastra/commit/f81d7cb89f122e1c01729a917c70ca62d6c51216), [`78cbed0`](https://github.com/mastra-ai/mastra/commit/78cbed0e0ed27b74d9b3b767566b21d513cddd53), [`beb81d3`](https://github.com/mastra-ai/mastra/commit/beb81d355b4a8e472ac411f33aa0d4854cb8662b), [`f99e0e5`](https://github.com/mastra-ai/mastra/commit/f99e0e5db6012fbdcd8eac8a32d762b2a1d56b5e), [`16d8f44`](https://github.com/mastra-ai/mastra/commit/16d8f44e3a1486d7319c1baeca6115d37f6c4cea)]:
  - @mastra/core@1.79.0
  - @mastra/parallel@0.1.3
  - @mastra/tavily@1.1.3
  - @mastra/client-js@1.56.0
  - @mastra/duckdb@1.15.0
  - @mastra/pg@1.32.0
  - @mastra/observability@1.21.0
  - @mastra/fastembed@1.3.4
  - @mastra/mcp@2.5.0
  - @mastra/memory@1.39.0
  - @mastra/libsql@1.27.0
  - @mastra/agent-browser@0.5.4
  - @mastra/stagehand@0.3.6
  - @mastra/schema-compat@1.3.16
  - @mastra/github-signals@0.5.2

## 1.15.0-alpha.13

### Patch Changes

- Added Extra high thinking to xAI models that list it, such as Grok 4.6. ([#26530](https://github.com/mastra-ai/mastra/pull/26530))

  ```ts
  import { getModelReasoningOptions } from '@mastra/core/llm';
  import { getAvailableThinkingLevelsForModel } from '@mastra/code-sdk/thinking';

  getAvailableThinkingLevelsForModel('xai/grok-4.6', getModelReasoningOptions('xai/grok-4.6'));
  // ['off', 'low', 'medium', 'high', 'xhigh']
  ```

- Updated dependencies [[`a92384b`](https://github.com/mastra-ai/mastra/commit/a92384bf9093beb9071953292a936ca722370ce5), [`a8f9157`](https://github.com/mastra-ai/mastra/commit/a8f9157fafe38f5acf68e37c8874ebd192ef8e10), [`4471372`](https://github.com/mastra-ai/mastra/commit/4471372b0338523a2f57407a90b1d913e68f17cc), [`0e9a577`](https://github.com/mastra-ai/mastra/commit/0e9a5774151385c93524883e2b1bea40e2a644de), [`fa5a031`](https://github.com/mastra-ai/mastra/commit/fa5a0316dbd5f68316b48c426fd904d2d80d9045), [`b8fe2ae`](https://github.com/mastra-ai/mastra/commit/b8fe2aec651efeaad6d607d816565453a341cdef), [`f54f8b2`](https://github.com/mastra-ai/mastra/commit/f54f8b2df2aa24e1ef4d171c733576e7c62bb1b0), [`f54f8b2`](https://github.com/mastra-ai/mastra/commit/f54f8b2df2aa24e1ef4d171c733576e7c62bb1b0), [`f54f8b2`](https://github.com/mastra-ai/mastra/commit/f54f8b2df2aa24e1ef4d171c733576e7c62bb1b0), [`f54f8b2`](https://github.com/mastra-ai/mastra/commit/f54f8b2df2aa24e1ef4d171c733576e7c62bb1b0), [`a0c031c`](https://github.com/mastra-ai/mastra/commit/a0c031ceb671721b6f8557726e216ee81d23612e), [`03868f8`](https://github.com/mastra-ai/mastra/commit/03868f840401865af433040ba7ff90f585dea2e1), [`bdf7dac`](https://github.com/mastra-ai/mastra/commit/bdf7dac468e3f0fdf66d2b2d964f839087e0cb99), [`33ee758`](https://github.com/mastra-ai/mastra/commit/33ee758d6c11991c9ecc356ae1015d18767fcd3a), [`e35e335`](https://github.com/mastra-ai/mastra/commit/e35e335f19ee0c7c1e03bf247aebd24c3e041459), [`e35e335`](https://github.com/mastra-ai/mastra/commit/e35e335f19ee0c7c1e03bf247aebd24c3e041459), [`f122808`](https://github.com/mastra-ai/mastra/commit/f1228088b6f60f6c7ef9db8b9aca70bc5cf9f00c), [`cc977b4`](https://github.com/mastra-ai/mastra/commit/cc977b4ce7def6727cdd63af3478d2b8b83daf07), [`d0251e3`](https://github.com/mastra-ai/mastra/commit/d0251e34973492c60e4dc7614116fcf912739875), [`16d8f44`](https://github.com/mastra-ai/mastra/commit/16d8f44e3a1486d7319c1baeca6115d37f6c4cea)]:
  - @mastra/core@1.79.0-alpha.12
  - @mastra/mcp@2.5.0-alpha.3
  - @mastra/client-js@1.56.0-alpha.12
  - @mastra/pg@1.32.0-alpha.6
  - @mastra/libsql@1.27.0-alpha.4

## 1.15.0-alpha.12

### Minor Changes

- `SandboxFilesystem` now uses the sandbox's native `filesystem` when it has one. File reads, writes, stats, and listings take one request instead of two or three shell commands, and every file operation goes through it. `grep` and file walks still run as shell commands. Paths with `..` are still rejected. ([#27859](https://github.com/mastra-ai/mastra/pull/27859))

  On the native path, the in-sandbox symlink check is skipped by default, since an agent with a shell can read any file anyway. Set `verifySymlinks: true` when you serve files to people who can't run commands; each path is then checked once per instance:

  ```ts
  const fs = new SandboxFilesystem({ sandbox, workdir: '/workspace/repo', verifySymlinks: true });
  ```

### Patch Changes

- Mastra Code sessions no longer load web search providers, the Postgres store, the local trace store (DuckDB), the MCP client, local embeddings or voice SDKs until a feature needs them, which cuts startup memory by about 90 MB. ([#27680](https://github.com/mastra-ai/mastra/pull/27680))

- Updated dependencies [[`f1b596e`](https://github.com/mastra-ai/mastra/commit/f1b596e3219bd8721079611c62b92b8f0f6c12d9), [`4e6701a`](https://github.com/mastra-ai/mastra/commit/4e6701a8534e29fad29c7fe4c6787dc1ed56b419), [`f905746`](https://github.com/mastra-ai/mastra/commit/f905746159def2d386dca516657123f43ef90e24), [`76d0af2`](https://github.com/mastra-ai/mastra/commit/76d0af2b0013147f6043d9fc44c44278065240e7), [`72cb1e2`](https://github.com/mastra-ai/mastra/commit/72cb1e2b9453f7bb1bd08e4f9aa54da56fa20600), [`5b936b6`](https://github.com/mastra-ai/mastra/commit/5b936b65d229865dabba01e49e36c8e19e7b2ebc), [`0e5d045`](https://github.com/mastra-ai/mastra/commit/0e5d045be4ab67d1fba5eeb8125bc2ec43aa9519), [`0e4fa4f`](https://github.com/mastra-ai/mastra/commit/0e4fa4f0604bb2e6e63e5d1d203b2dcadd646a81), [`d7c012f`](https://github.com/mastra-ai/mastra/commit/d7c012fcc98a18552e0aef55f9c0d19fccad57da), [`a7bfa1f`](https://github.com/mastra-ai/mastra/commit/a7bfa1ff7c592f368cf34be472c7d89e03b0098b)]:
  - @mastra/core@1.79.0-alpha.11
  - @mastra/client-js@1.56.0-alpha.11
  - @mastra/libsql@1.27.0-alpha.4
  - @mastra/memory@1.39.0-alpha.8
  - @mastra/mcp@2.5.0-alpha.2

## 1.15.0-alpha.11

### Patch Changes

- `/om` now shows the same Auto memory model that runs use. Before, the preview only checked `GOOGLE_GENERATIVE_AI_API_KEY`, so with `GOOGLE_API_KEY` or a Google key saved with `mastracode login` it showed Claude Haiku while runs used Gemini Flash. ([#27449](https://github.com/mastra-ai/mastra/pull/27449))

- Scheduled prompts that fire into a session no longer held live in this process now run as that session's owner. Hosts that resume sessions (`resumeWakeSession`) bring the owner's session back first; if no owner can be found, the fire fails with `No session owns resource … to run its wake on thread …` before any run starts, instead of starting a run with no signed-in user that failed with "Tenant model credential policy could not be resolved: the request has no authenticated user." Only hosts with schedule tools enabled are affected. ([#27780](https://github.com/mastra-ai/mastra/pull/27780))

- Updated dependencies [[`59c02f5`](https://github.com/mastra-ai/mastra/commit/59c02f53955dde397f343f2107060ed70bbe63c5), [`9c66073`](https://github.com/mastra-ai/mastra/commit/9c66073db33749ab622d54db7e8885f183451ca4), [`e5b6877`](https://github.com/mastra-ai/mastra/commit/e5b6877fbdb471485b99019eb50046b44e778aae), [`e5b6877`](https://github.com/mastra-ai/mastra/commit/e5b6877fbdb471485b99019eb50046b44e778aae), [`5035d61`](https://github.com/mastra-ai/mastra/commit/5035d619e9b3369ba9bda264ac0460528012168b), [`8c05e78`](https://github.com/mastra-ai/mastra/commit/8c05e78b099b26daf4bfa9b229190201c8bf581d)]:
  - @mastra/core@1.79.0-alpha.10
  - @mastra/memory@1.39.0-alpha.7
  - @mastra/client-js@1.56.0-alpha.10

## 1.15.0-alpha.10

### Patch Changes

- Background task completions and notification wake-ups now find their session by session id, so they keep reaching the right session when several sessions share one resource. ([#27336](https://github.com/mastra-ai/mastra/pull/27336))

- Factory sessions now always use thread-scoped observational memory. Each run and chat keeps its own observations, and recall search still reaches every thread under the Factory or user resource. Session state, the `MASTRA_OM_SCOPE` environment variable, and `.mastracode/database.json` no longer change the scope for Factory sessions. Mastra Code outside Factory resolves the scope as before. ([#27337](https://github.com/mastra-ai/mastra/pull/27337))

- Updated dependencies [[`6362d32`](https://github.com/mastra-ai/mastra/commit/6362d32a905d32820dcab3b9a039ebc1cec4f444), [`6362d32`](https://github.com/mastra-ai/mastra/commit/6362d32a905d32820dcab3b9a039ebc1cec4f444), [`e3678a5`](https://github.com/mastra-ai/mastra/commit/e3678a564cf3bb5922112b4dca65973c5fdc0a92), [`9c4d65f`](https://github.com/mastra-ai/mastra/commit/9c4d65f41ee21e407f0015b0e745881288f69d05), [`7425858`](https://github.com/mastra-ai/mastra/commit/74258589417e9e91114c64571a67702d2e352b3f), [`5fb8ea6`](https://github.com/mastra-ai/mastra/commit/5fb8ea65342d0a5d2541e4ec25b8d37d3b9e14ea), [`a97ba85`](https://github.com/mastra-ai/mastra/commit/a97ba8578a2dc91a16d945276ca8c7a4ad32e38a), [`750a4ed`](https://github.com/mastra-ai/mastra/commit/750a4edf7826da9ba7321682912504c60f29712d), [`c236d64`](https://github.com/mastra-ai/mastra/commit/c236d64974c68e6c0f9bf6e3d6442e0184c5f49e), [`22df9d7`](https://github.com/mastra-ai/mastra/commit/22df9d76651b3b4d513388a7eae8e51dbfb36a1b), [`0971298`](https://github.com/mastra-ai/mastra/commit/0971298317be971ae1c3f0c1d949a31df7d71c7f), [`6362d32`](https://github.com/mastra-ai/mastra/commit/6362d32a905d32820dcab3b9a039ebc1cec4f444), [`e3678a5`](https://github.com/mastra-ai/mastra/commit/e3678a564cf3bb5922112b4dca65973c5fdc0a92), [`98c7e10`](https://github.com/mastra-ai/mastra/commit/98c7e109fca4995d19d7eb132fdb8411c860b151), [`e3678a5`](https://github.com/mastra-ai/mastra/commit/e3678a564cf3bb5922112b4dca65973c5fdc0a92), [`5d5ea03`](https://github.com/mastra-ai/mastra/commit/5d5ea032a4c64cefe5bc217f4cc761a9364ccbf4), [`7704aa1`](https://github.com/mastra-ai/mastra/commit/7704aa18b657ba89ddbf91bf193bb3dfbb56c5f2)]:
  - @mastra/client-js@1.56.0-alpha.9
  - @mastra/core@1.79.0-alpha.9
  - @mastra/duckdb@1.15.0-alpha.5
  - @mastra/pg@1.32.0-alpha.5
  - @mastra/memory@1.39.0-alpha.6

## 1.15.0-alpha.9

### Patch Changes

- Updated dependencies [[`3012dd4`](https://github.com/mastra-ai/mastra/commit/3012dd424b2329eda78381688f1f48244173e6a2), [`3012dd4`](https://github.com/mastra-ai/mastra/commit/3012dd424b2329eda78381688f1f48244173e6a2), [`78b3ef7`](https://github.com/mastra-ai/mastra/commit/78b3ef7cb120f2b366a39d7095ece5f0ec7d3f71), [`984fd2a`](https://github.com/mastra-ai/mastra/commit/984fd2a2139ee9a8b2cefd331f071210cf524e4d), [`3012dd4`](https://github.com/mastra-ai/mastra/commit/3012dd424b2329eda78381688f1f48244173e6a2), [`f9e22cc`](https://github.com/mastra-ai/mastra/commit/f9e22cc6fa264ded4a95ab34dab84b6ce12c2597), [`fed802d`](https://github.com/mastra-ai/mastra/commit/fed802d6e4e395d9ba42a1122c2468a072407b1c), [`3012dd4`](https://github.com/mastra-ai/mastra/commit/3012dd424b2329eda78381688f1f48244173e6a2)]:
  - @mastra/pg@1.32.0-alpha.4
  - @mastra/duckdb@1.15.0-alpha.4
  - @mastra/core@1.79.0-alpha.8
  - @mastra/client-js@1.56.0-alpha.8

## 1.15.0-alpha.8

### Patch Changes

- dependencies updates: ([#27728](https://github.com/mastra-ai/mastra/pull/27728))
  - Updated dependency [`@ai-sdk/amazon-bedrock@^3.0.140` ↗︎](https://www.npmjs.com/package/@ai-sdk/amazon-bedrock/v/3.0.140) (from `^3.0.111`, in `dependencies`)
  - Updated dependency [`@ai-sdk/anthropic@^3.0.133` ↗︎](https://www.npmjs.com/package/@ai-sdk/anthropic/v/3.0.133) (from `^3.0.103`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai@^3.0.130` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai/v/3.0.130) (from `^3.0.88`, in `dependencies`)
  - Updated dependency [`@ai-sdk/openai-compatible@^2.0.85` ↗︎](https://www.npmjs.com/package/@ai-sdk/openai-compatible/v/2.0.85) (from `^2.0.62`, in `dependencies`)
  - Updated dependency [`ai@^6.0.309` ↗︎](https://www.npmjs.com/package/ai/v/6.0.309) (from `^6.0.236`, in `dependencies`)

- Added a `resumeWakeSession` option to `createMastraCode`. It runs when a notification is due on a thread whose session isn't open in this process, so the host can bring that session back online as its owner before the wake runs. If no session owns the thread afterwards, or the hook throws, the delivery fails with that error instead of waking with no user. ([#27729](https://github.com/mastra-ai/mastra/pull/27729))

  Pair it with `prepareWakeRequestContext`, which attaches the owner's identity to the wake itself:

  ```ts
  const code = await createMastraCode({
    resumeWakeSession: async ({ resourceId, threadId }) => {
      const owner = await lookupSessionOwner(resourceId);
      if (!owner) throw new Error(`Session ${resourceId} has no known owner`);
      const requestContext = new RequestContext([['user', owner]]);
      await code.controller.createSession({ id: resourceId, resourceId, ownerId: owner.id, threadId, requestContext });
    },
    prepareWakeRequestContext: async ({ requestContext, resourceId }) => {
      requestContext.set('user', await lookupSessionOwner(resourceId));
    },
  });
  ```

- Updated dependencies [[`dbde4bf`](https://github.com/mastra-ai/mastra/commit/dbde4bf36ac016abcda61868cc6f792f9d07abee), [`3af753f`](https://github.com/mastra-ai/mastra/commit/3af753fb40a2b8f7ab17b1cf16cd4da7e1b020a6), [`ad77770`](https://github.com/mastra-ai/mastra/commit/ad777701b62651f8bef64abfc4ea91cef0cd6ac3), [`e13dddd`](https://github.com/mastra-ai/mastra/commit/e13dddd4f5ac10448cd37009c31efedbf4c40ff4), [`3624981`](https://github.com/mastra-ai/mastra/commit/36249818e7cd0b2904142c6b133cc1ceb756ba68), [`04ded0b`](https://github.com/mastra-ai/mastra/commit/04ded0b7409b39008a1e4611c412ee80ee20993d), [`022e6cf`](https://github.com/mastra-ai/mastra/commit/022e6cf06fdc891a6318f16db304be8fe75b7f72), [`d8fb857`](https://github.com/mastra-ai/mastra/commit/d8fb857bda2c23a08e535291a638fbc6e3a4e073), [`ace1e35`](https://github.com/mastra-ai/mastra/commit/ace1e35d5762f96976a2cba958283edda71fcc3b), [`ba744e5`](https://github.com/mastra-ai/mastra/commit/ba744e5347d7d373b89233f1b8beddb5bdf5b2c3), [`b69dcad`](https://github.com/mastra-ai/mastra/commit/b69dcadb02a2630755a859bd4454c1b133e565ce), [`80b382d`](https://github.com/mastra-ai/mastra/commit/80b382d183d60ee39f276d1033552575966d5ddd), [`5758ba0`](https://github.com/mastra-ai/mastra/commit/5758ba045b01c407a7414b32dbbdf5480596b31d), [`8271439`](https://github.com/mastra-ai/mastra/commit/8271439b491f5f777590abfda9a0ac7f1e3212c2), [`0ac6a2a`](https://github.com/mastra-ai/mastra/commit/0ac6a2a4ab19f294b5362bcdf9c8ae9e3d8a3ede), [`e4cd1d1`](https://github.com/mastra-ai/mastra/commit/e4cd1d13de8bcb14d8d0a8531f7b96fcbb138217), [`7aa0361`](https://github.com/mastra-ai/mastra/commit/7aa036142ca476b1f1e18a220f826e73ca58c38a), [`3f68324`](https://github.com/mastra-ai/mastra/commit/3f68324e72f03bbc7d918d23013f550527f59c40), [`100431b`](https://github.com/mastra-ai/mastra/commit/100431b965dba5d32d282cfcd3c0415013cc0eed), [`f42951a`](https://github.com/mastra-ai/mastra/commit/f42951afb1d2c2a2148100a54b6ec10d473c9591), [`0876fa8`](https://github.com/mastra-ai/mastra/commit/0876fa827a9685022fb0dc1606cbb673dffcaf95), [`f81d7cb`](https://github.com/mastra-ai/mastra/commit/f81d7cb89f122e1c01729a917c70ca62d6c51216)]:
  - @mastra/core@1.79.0-alpha.7
  - @mastra/client-js@1.56.0-alpha.7
  - @mastra/fastembed@1.3.4-alpha.2

## 1.15.0-alpha.7

### Patch Changes

- Updated dependencies [[`41b7f34`](https://github.com/mastra-ai/mastra/commit/41b7f3422a97f1385a285002b7e6f898eb5c7b06), [`179964b`](https://github.com/mastra-ai/mastra/commit/179964b95aacac31763a4a1aa2f2d1c652aa529d), [`ba7b0ea`](https://github.com/mastra-ai/mastra/commit/ba7b0eac045755d39d20dcf3a943ea5f8270b009), [`e8d7f8e`](https://github.com/mastra-ai/mastra/commit/e8d7f8e52da32b05f2e8501c1127128ae1a5d450), [`92034fa`](https://github.com/mastra-ai/mastra/commit/92034fa2a46a4f45af416c3201752342ead71d89)]:
  - @mastra/core@1.79.0-alpha.6
  - @mastra/memory@1.39.0-alpha.5
  - @mastra/client-js@1.56.0-alpha.6

## 1.15.0-alpha.6

### Patch Changes

- Improved content search in sandbox workspaces without ripgrep. When the sandbox's GNU grep and git support PCRE, patterns run with `grep -P` and `git grep -P`, so `\d`, `\w`, `\s`, `\b`, and lookarounds are searched in one command instead of falling back to reading files one by one. ([#27698](https://github.com/mastra-ai/mastra/pull/27698))

- Updated dependencies [[`6b8435c`](https://github.com/mastra-ai/mastra/commit/6b8435c1aaad98a3a5218ececbc45107968c9218), [`40a76a8`](https://github.com/mastra-ai/mastra/commit/40a76a854d9246aa8b8ba25ab3f58d7542e0ffea)]:
  - @mastra/memory@1.39.0-alpha.4
  - @mastra/libsql@1.27.0-alpha.3

## 1.15.0-alpha.5

### Patch Changes

- Fixed sandbox workspace search staying on the slow fallback for the whole session when its first search ran before the sandbox was ready. A failed search-tool check is now retried on the next search. ([#27695](https://github.com/mastra-ai/mastra/pull/27695))

- Made content search in sandbox workspaces much faster when ripgrep isn't installed. Searches now run as a single GNU grep command with context lines, using git to respect every repository's `.gitignore`, instead of reading files one by one. With ripgrep, searches also respect `.gitignore` files now. Both skip `node_modules` unless the search path points inside it. File listings in sandbox workspaces also skip `node_modules` inside the sandbox instead of returning it to be filtered out. ([#27687](https://github.com/mastra-ai/mastra/pull/27687))

- Updated dependencies [[`ec84d93`](https://github.com/mastra-ai/mastra/commit/ec84d93cda24d56a0812086fcaace9e68ce8e089), [`79fd3b0`](https://github.com/mastra-ai/mastra/commit/79fd3b06a7cf59f7acb4591b9ba0f388d548fd17), [`f28b72f`](https://github.com/mastra-ai/mastra/commit/f28b72f255a460746f08c73b2a1d336bfc57757b), [`6c67158`](https://github.com/mastra-ai/mastra/commit/6c67158a10406adae195887167862d632bb54d64), [`ad8e752`](https://github.com/mastra-ai/mastra/commit/ad8e75217bcbb12986e7e77a30cb4af1be93c0fd), [`85a26af`](https://github.com/mastra-ai/mastra/commit/85a26af75fe62b7f2d8ac0b56d322798e5ae0616), [`d0f9cbd`](https://github.com/mastra-ai/mastra/commit/d0f9cbd37681e610e634ca69e3fd8210ac0fc0ef), [`0a88b7c`](https://github.com/mastra-ai/mastra/commit/0a88b7c6ec1ba548c67317ffff1169310b8d4b8d), [`e0077c3`](https://github.com/mastra-ai/mastra/commit/e0077c34070037ac77c264a9d5000a69c0dd2095)]:
  - @mastra/core@1.79.0-alpha.5
  - @mastra/memory@1.39.0-alpha.3
  - @mastra/client-js@1.56.0-alpha.5
  - @mastra/libsql@1.27.0-alpha.3

## 1.15.0-alpha.4

### Patch Changes

- Fixed ACP turns that an internal error ended returning `stopReason: "cancelled"` when the client never cancelled. `session/prompt` now returns a JSON-RPC error with the underlying message, so clients can tell a failure apart from a cancel. ([#27438](https://github.com/mastra-ai/mastra/pull/27438))

- Fixed the local trace store (`observability.duckdb`, used when `/observability local on`) growing without limit. Each session now deletes traces, logs and metrics older than 14 days and scores and feedback older than 30 days in the background, capped per session so startup is never blocked. ([#27506](https://github.com/mastra-ai/mastra/pull/27506))

- Credential resolution failures (for example a run with no signed-in user) are now logged as errors through the Mastra instance's logger, so they appear in deployed logs. The missing-user error also includes the session and thread ids and the names of the request context entries, so the code path that started the run can be identified. ([#27376](https://github.com/mastra-ai/mastra/pull/27376))

- Fixed notifications for the thread you have open being treated as belonging to another project when the thread's recorded project path differs from the current checkout. Such notifications now run in your session instead of failing with "No model available". If a Mastra Code process for the thread's own project is also running, only one of the two delivers each notification. ([#27634](https://github.com/mastra-ai/mastra/pull/27634))

- Fixed a `prune() failed for domain "observability"` error being logged the first time local tracing opened a new `observability.duckdb` file. Mastra Code now skips the startup prune until the trace tables exist; the next session prunes as usual. ([#27517](https://github.com/mastra-ai/mastra/pull/27517))

- Improved sandbox grep reliability and diagnostics. When `rg` or `grep` fails inside the sandbox, the error now says why, for example a timeout or an exit code with the first stderr line. Previously every failure was reported as an unsupported pattern. The POSIX `grep` fallback now skips `.git`, and it keeps matches when only some files could not be read. ([#27464](https://github.com/mastra-ai/mastra/pull/27464))

- Fixed woken notifications running in the wrong project when Mastra Code processes in different directories share one resource id. A due notification now runs as the session whose project the thread belongs to, and is delivered by a process running in that project: each project gets its own notification dispatch turn on the shared resource, so a process no longer runs another project's thread with its own workspace and tools, and no longer leaves it waiting until the process holding the resource exits. ([#27426](https://github.com/mastra-ai/mastra/pull/27426))

- Updated dependencies [[`8bbf696`](https://github.com/mastra-ai/mastra/commit/8bbf69693321c3308f85276a5bdfc2469b40dd8e), [`8bbf696`](https://github.com/mastra-ai/mastra/commit/8bbf69693321c3308f85276a5bdfc2469b40dd8e), [`1c9fd9b`](https://github.com/mastra-ai/mastra/commit/1c9fd9bbdd4258c0d86c89cac6ae68c5023a2590), [`934ec13`](https://github.com/mastra-ai/mastra/commit/934ec1315e8ee4b73067864f56a9fcc8105e8512), [`14f17b8`](https://github.com/mastra-ai/mastra/commit/14f17b86e2b162623bb22942c7930c2113a6d8a1), [`915fbe6`](https://github.com/mastra-ai/mastra/commit/915fbe67e974edbeba4dbd3afeaec4d68b34b118), [`9b546e2`](https://github.com/mastra-ai/mastra/commit/9b546e2b9dba91d51769a73ce1a0b34d775b144a), [`44e35e4`](https://github.com/mastra-ai/mastra/commit/44e35e47491ad5fd9f771526d5d8c312644000ec), [`336692a`](https://github.com/mastra-ai/mastra/commit/336692a646e28d24b303eefdb8fdbe64e4b4e801), [`f1c68eb`](https://github.com/mastra-ai/mastra/commit/f1c68eb4ae080d8cbbc694ae580850d8fa94dece), [`97f78c3`](https://github.com/mastra-ai/mastra/commit/97f78c3cf104600887e08e94cc073c973bb53c3b), [`6bfe708`](https://github.com/mastra-ai/mastra/commit/6bfe7087fcc27a08c8cba95a45c5da353188bb9c), [`a3f8ac0`](https://github.com/mastra-ai/mastra/commit/a3f8ac03c7526248e585f3e4e87b349566dd4797), [`26e684b`](https://github.com/mastra-ai/mastra/commit/26e684b1f152d341c2dca01c5347fea7e8762188), [`b77f59c`](https://github.com/mastra-ai/mastra/commit/b77f59cc5407b1158a271d579b55514f2ba79145), [`776bb6e`](https://github.com/mastra-ai/mastra/commit/776bb6e2b3ed9ec32e5430332ee756185fcebb68), [`2d0a3b0`](https://github.com/mastra-ai/mastra/commit/2d0a3b06d0880036c0dbd4b1fcf782d1f5115a56), [`5131dad`](https://github.com/mastra-ai/mastra/commit/5131dadf8c2db8641030111203db6c16fe3240f2), [`58db748`](https://github.com/mastra-ai/mastra/commit/58db74858beae6ff20ff22786c968386b9d3edcc), [`fd98055`](https://github.com/mastra-ai/mastra/commit/fd98055302882876b8dc5ae03649a89a72e2ac6c), [`b2c91db`](https://github.com/mastra-ai/mastra/commit/b2c91dbd2d32e18cd114d87301fc3b8182fddb10), [`c111a5b`](https://github.com/mastra-ai/mastra/commit/c111a5bfa2a7a197f30700ce238c84ee799df140), [`fc96794`](https://github.com/mastra-ai/mastra/commit/fc9679466bede4ca3e014aea48a72fd950a13d2a), [`44e35e4`](https://github.com/mastra-ai/mastra/commit/44e35e47491ad5fd9f771526d5d8c312644000ec), [`7337dac`](https://github.com/mastra-ai/mastra/commit/7337dac8aad8d70e98a4b0c7caa677c01966b53b), [`fc96794`](https://github.com/mastra-ai/mastra/commit/fc9679466bede4ca3e014aea48a72fd950a13d2a), [`f51c0af`](https://github.com/mastra-ai/mastra/commit/f51c0afdd1b181b84e294f8613185494a8aaec3c), [`5f70db1`](https://github.com/mastra-ai/mastra/commit/5f70db1f3b5b38a27438d1c153db352d2bc8de30), [`7afee18`](https://github.com/mastra-ai/mastra/commit/7afee18a3d91ce125f08ffd6e2724695e8a68652), [`ca1b2f2`](https://github.com/mastra-ai/mastra/commit/ca1b2f25d7c69c6e90b719baef32ffb1db6c5681), [`2a88e01`](https://github.com/mastra-ai/mastra/commit/2a88e018493abde76930e91df4d947506557ad53), [`fc96794`](https://github.com/mastra-ai/mastra/commit/fc9679466bede4ca3e014aea48a72fd950a13d2a), [`6309939`](https://github.com/mastra-ai/mastra/commit/63099393563cc177960862c9179c4e2420acac5f), [`f6260f8`](https://github.com/mastra-ai/mastra/commit/f6260f8cc50c21a5d78d47fff4e04e55aca57a08), [`9b546e2`](https://github.com/mastra-ai/mastra/commit/9b546e2b9dba91d51769a73ce1a0b34d775b144a), [`a3be51b`](https://github.com/mastra-ai/mastra/commit/a3be51b1a545b45bfb04377699edecbb8a8d79d6), [`bcfb6af`](https://github.com/mastra-ai/mastra/commit/bcfb6af5a61d79f6902e87d3a8fa70283f48705d), [`fc96794`](https://github.com/mastra-ai/mastra/commit/fc9679466bede4ca3e014aea48a72fd950a13d2a), [`a98fe9c`](https://github.com/mastra-ai/mastra/commit/a98fe9c9b115830ee7db787f2c5e7499cceb8979), [`368149c`](https://github.com/mastra-ai/mastra/commit/368149c27954f6d578d3561cc1801cb415b78aa7), [`fdf475d`](https://github.com/mastra-ai/mastra/commit/fdf475dbc8974e1ae21966e5e96e316a7beebdf7), [`2725bd7`](https://github.com/mastra-ai/mastra/commit/2725bd73fa27f231e30bce7c6a03c651bc15b408), [`0611d4a`](https://github.com/mastra-ai/mastra/commit/0611d4a060696da5c3c550b07451d870d4af0f58), [`0eb8311`](https://github.com/mastra-ai/mastra/commit/0eb8311f9ecf254c96179e99dc145d6df3cccd07), [`9b546e2`](https://github.com/mastra-ai/mastra/commit/9b546e2b9dba91d51769a73ce1a0b34d775b144a), [`c397dff`](https://github.com/mastra-ai/mastra/commit/c397dff0ee0662b56f348852ad08aff820239d66), [`f96161a`](https://github.com/mastra-ai/mastra/commit/f96161af6355c640738df4b9d3fcdad601f6b6df), [`92ea5c9`](https://github.com/mastra-ai/mastra/commit/92ea5c92eb62e31ce005d1f43072b74d81577715), [`b2c91db`](https://github.com/mastra-ai/mastra/commit/b2c91dbd2d32e18cd114d87301fc3b8182fddb10), [`b03ee08`](https://github.com/mastra-ai/mastra/commit/b03ee089c70c087cdc9d1d0a85aa749621ad5a3c), [`0f1d83f`](https://github.com/mastra-ai/mastra/commit/0f1d83fed073613869d6283adb198b934ef80093), [`cd864ca`](https://github.com/mastra-ai/mastra/commit/cd864ca5d1fa6cb3477cb8a87b79070febbb3b6b), [`d95a821`](https://github.com/mastra-ai/mastra/commit/d95a821e903f7883b5fadfee5c7f59809d66cfb8), [`d95a821`](https://github.com/mastra-ai/mastra/commit/d95a821e903f7883b5fadfee5c7f59809d66cfb8), [`d95a821`](https://github.com/mastra-ai/mastra/commit/d95a821e903f7883b5fadfee5c7f59809d66cfb8), [`d95a821`](https://github.com/mastra-ai/mastra/commit/d95a821e903f7883b5fadfee5c7f59809d66cfb8), [`b0f7f91`](https://github.com/mastra-ai/mastra/commit/b0f7f91eb667f15e188b861759b4c4a5761ec233), [`958d170`](https://github.com/mastra-ai/mastra/commit/958d170c218a0e050c0c4807a94ce1f67f00e570), [`ba7d4e5`](https://github.com/mastra-ai/mastra/commit/ba7d4e5c9759a164279c7ebdbe2b7a32ae94b4ce), [`8b36444`](https://github.com/mastra-ai/mastra/commit/8b36444dbbc6916d298015c2586fbbde2e9b265f), [`bfd35f6`](https://github.com/mastra-ai/mastra/commit/bfd35f64178f06774c95dabec4a796245cf8a401), [`0b5eaa0`](https://github.com/mastra-ai/mastra/commit/0b5eaa07445a6551481ab6ceadef603b020a099b), [`9620613`](https://github.com/mastra-ai/mastra/commit/96206136bcc184e6238bd6dd5627fe28254eec0b), [`c36b9e7`](https://github.com/mastra-ai/mastra/commit/c36b9e7129b355211ed9e7a3b7df2d7b81c01c05), [`c82558f`](https://github.com/mastra-ai/mastra/commit/c82558f2e5eedb493afff46f940ab7f3c085d57f), [`7a0aea2`](https://github.com/mastra-ai/mastra/commit/7a0aea28af3bcf879a75b5bcdbfc3d471f63c565), [`7a0aea2`](https://github.com/mastra-ai/mastra/commit/7a0aea28af3bcf879a75b5bcdbfc3d471f63c565), [`a0471fe`](https://github.com/mastra-ai/mastra/commit/a0471fefaf92a44b44f5fb23e607fdad087e51f2), [`9b546e2`](https://github.com/mastra-ai/mastra/commit/9b546e2b9dba91d51769a73ce1a0b34d775b144a), [`bde069a`](https://github.com/mastra-ai/mastra/commit/bde069ac2f610abd5a09bcdb511ed04f5f01437e), [`7f4a1ca`](https://github.com/mastra-ai/mastra/commit/7f4a1ca724829e0a732eea6afb285f15908df8e9), [`ae74f81`](https://github.com/mastra-ai/mastra/commit/ae74f812d75034a90d647739062b9c2ca84b4ed6), [`b23b87b`](https://github.com/mastra-ai/mastra/commit/b23b87b8ab849cdc9f58b297d667c0bbaed0b62f), [`f1a5cdc`](https://github.com/mastra-ai/mastra/commit/f1a5cdc2ae5c0cd3edb096bf47672f205f65aefa), [`c8035a4`](https://github.com/mastra-ai/mastra/commit/c8035a49ae2af692d812dace394ac64635f5fd1d), [`1980959`](https://github.com/mastra-ai/mastra/commit/1980959335396f8ee72558689623abf3e205b31b), [`fa409d4`](https://github.com/mastra-ai/mastra/commit/fa409d430b879e45d433497439c0c11d2a3fafd6), [`78cbed0`](https://github.com/mastra-ai/mastra/commit/78cbed0e0ed27b74d9b3b767566b21d513cddd53), [`f99e0e5`](https://github.com/mastra-ai/mastra/commit/f99e0e5db6012fbdcd8eac8a32d762b2a1d56b5e)]:
  - @mastra/parallel@0.1.3-alpha.1
  - @mastra/tavily@1.1.3-alpha.1
  - @mastra/core@1.79.0-alpha.4
  - @mastra/pg@1.32.0-alpha.3
  - @mastra/duckdb@1.15.0-alpha.3
  - @mastra/mcp@2.5.0-alpha.1
  - @mastra/client-js@1.56.0-alpha.4
  - @mastra/memory@1.39.0-alpha.2
  - @mastra/libsql@1.27.0-alpha.3
  - @mastra/observability@1.21.0-alpha.2

## 1.15.0-alpha.3

### Minor Changes

- Added a Factory client for driving a remote Factory session. `RemoteSession` and `RemoteController` mirror a Factory session's state over its event stream and forward messages, approvals, and mode/model switches over HTTP. Platform helpers sign in to Mastra Platform and discover the organizations, projects, and environments to connect to. ([#27222](https://github.com/mastra-ai/mastra/pull/27222))

  ```ts
  import { createFactoryClient } from '@mastra/code-sdk/factory/client';
  import { RemoteSession } from '@mastra/code-sdk/factory/remote-session';
  import { getPlatformSession } from '@mastra/code-sdk/platform/index';

  const session = await getPlatformSession();
  const client = createFactoryClient({ url: 'https://my-factory.factory.mastra.cloud', session });
  ```

  Requests that fail with an expired Platform token refresh it once and retry.

### Patch Changes

- Fixed "build a workflow" requests never finishing in Mastra Code. The workflow builder no longer inherits the chat session's memory thread, so it stops waiting on the session run that is waiting on it. ([#27323](https://github.com/mastra-ai/mastra/pull/27323))

- Fixed the cross-agent signal sender telling the model to resend a signal that failed direct delivery. The signal waits in the recipient's inbox and is retried automatically, so the sender now tells the model not to resend it. A resend while that signal is still pending merges into it; a resend after it is delivered sends the recipient a second copy. ([#27347](https://github.com/mastra-ai/mastra/pull/27347))

- Updated dependencies [[`90dca88`](https://github.com/mastra-ai/mastra/commit/90dca88f44f31428a0e585584114b56f0bec477b), [`90dca88`](https://github.com/mastra-ai/mastra/commit/90dca88f44f31428a0e585584114b56f0bec477b), [`9cb6843`](https://github.com/mastra-ai/mastra/commit/9cb6843a8a39ab2e12498b0c08c9f4cdcefd9cea), [`9277d8e`](https://github.com/mastra-ai/mastra/commit/9277d8ef26ad2f08bfbae89d78d409fb91c95c8d), [`e41478c`](https://github.com/mastra-ai/mastra/commit/e41478cbb7ab108cf7f704a6f0f4092ec4374e21), [`e41478c`](https://github.com/mastra-ai/mastra/commit/e41478cbb7ab108cf7f704a6f0f4092ec4374e21), [`680d914`](https://github.com/mastra-ai/mastra/commit/680d9141c851e8eb6fcd2d3c3fbadf05a0f1011d), [`beb81d3`](https://github.com/mastra-ai/mastra/commit/beb81d355b4a8e472ac411f33aa0d4854cb8662b)]:
  - @mastra/core@1.79.0-alpha.3
  - @mastra/memory@1.39.0-alpha.1
  - @mastra/client-js@1.56.0-alpha.3

## 1.15.0-alpha.2

### Minor Changes

- Added an `outputProcessors` option to `createMastraCode`. Output processors you pass run after Mastra Code's built-in ones and before memory saves the reply, so changes they make to response messages are persisted. ([#27162](https://github.com/mastra-ai/mastra/pull/27162))

  ```ts
  const mastraCode = await createMastraCode({
    outputProcessors: ({ requestContext }) => [new ReplyLabelProcessor(requestContext)],
  });
  ```

### Patch Changes

- Added `normalizeLegacyProviderId` to `@mastra/code-sdk/providers/model-ids`. It maps a provider id Mastra Code once defined itself to the catalog id models.dev uses, so a reply's provider can be matched against the catalog. ([#27162](https://github.com/mastra-ai/mastra/pull/27162))

  ```ts
  import { normalizeLegacyProviderId } from '@mastra/code-sdk/providers/model-ids';

  normalizeLegacyProviderId('kimi-for-coding'); // 'kimi-code-plan-cn'
  normalizeLegacyProviderId('anthropic'); // 'anthropic'
  ```

- Fixed headless `--output jsonl` runs writing gigabytes of repeated data. The stream included a `display_state_changed` event after almost every other event, and each one carried a full copy of the session's display state, including every large tool result and all shell output so far. Long runs could fill the disk. ([#26881](https://github.com/mastra-ai/mastra/pull/26881))

  `--output jsonl` no longer writes `display_state_changed` events. Every other event, and the final `result` line, is written as before. The omitted snapshots only repeated what the other events already carry. Consumers that rebuilt UI state from these snapshots should fold the remaining events instead. `--output json`, `--output human`, and programmatic `runMC()` iteration are unchanged.

- Fixed foreground commands in Mastra Code to stop after 30 seconds unless the command specifies a timeout. Set timeout to 0 to disable the limit. Background processes are unaffected. ([#26878](https://github.com/mastra-ai/mastra/pull/26878))

- Fixed headless runs reporting success while a tool was still waiting for an answer. When a tool such as `request_access` paused the run, `runMC` stopped with `status: 'completed'` and exit code `0`, so the answer from the permission policy was never applied. Headless runs now wait for the paused run to stop, send the policy's answer, and keep running until the resumed run finishes. If a paused tool can't be resumed, the run ends with `status: 'error'` and exit code `1` instead of reporting success. ([#26883](https://github.com/mastra-ai/mastra/pull/26883))

- Fixed headless runs cutting off their output when stdout is a pipe. The CLI exited before Node finished writing, so a large final result could reach the reader incomplete while the process still exited with code 0. Headless mode now waits for stdout and stderr to flush before exiting. If the output can't be delivered because the reader closed the pipe, a run that would otherwise succeed exits with code 1 instead of 0. A run that already failed keeps its exit code. ([#26880](https://github.com/mastra-ai/mastra/pull/26880))

- Updated dependencies [[`871f3c8`](https://github.com/mastra-ai/mastra/commit/871f3c801640148cffa09474fc9f9032495ddccf), [`aaedaa6`](https://github.com/mastra-ai/mastra/commit/aaedaa634aa7394789952d4f9fe04b1aec8619a1), [`d8bfd3d`](https://github.com/mastra-ai/mastra/commit/d8bfd3d502dd9952db66f0c4f53cd04f5c8e71ef), [`0f337be`](https://github.com/mastra-ai/mastra/commit/0f337be51ebddbe1cf388e926155b737538de1db), [`6eeb344`](https://github.com/mastra-ai/mastra/commit/6eeb34446435ff7b446ced421ffae9951d4cc733), [`12991bd`](https://github.com/mastra-ai/mastra/commit/12991bd0945ca36e13b213ebcbfaf0880d04d44d), [`a74f28c`](https://github.com/mastra-ai/mastra/commit/a74f28cca56118bf5f7d3354a5e991508f927dbc), [`6889aa2`](https://github.com/mastra-ai/mastra/commit/6889aa29d661a8892f503e37bc3d8ffe18aa7e37), [`323b021`](https://github.com/mastra-ai/mastra/commit/323b0212bc57c2b9acaed2716812a873c0fa43ee), [`4e44e7f`](https://github.com/mastra-ai/mastra/commit/4e44e7f518debb3b0aebc5ad71ea3e4a3902d8c9), [`3c2c033`](https://github.com/mastra-ai/mastra/commit/3c2c033aa68cd8cd7e4c630abd7f1bfeb440f457), [`6889aa2`](https://github.com/mastra-ai/mastra/commit/6889aa29d661a8892f503e37bc3d8ffe18aa7e37), [`12407df`](https://github.com/mastra-ai/mastra/commit/12407df9e6bd2f82cd27533bd4a9aa8057b97f2e), [`6889aa2`](https://github.com/mastra-ai/mastra/commit/6889aa29d661a8892f503e37bc3d8ffe18aa7e37)]:
  - @mastra/core@1.79.0-alpha.2
  - @mastra/fastembed@1.3.4-alpha.1
  - @mastra/libsql@1.27.0-alpha.2
  - @mastra/pg@1.32.0-alpha.2
  - @mastra/duckdb@1.15.0-alpha.2

## 1.15.0-alpha.1

### Patch Changes

- Updated dependencies [[`48bee02`](https://github.com/mastra-ai/mastra/commit/48bee02e1a5cef20f4da67720191d5e85cdca13c), [`d93662b`](https://github.com/mastra-ai/mastra/commit/d93662bfee9313c376cff90e910e05ec9b0634ea), [`5d8f8b7`](https://github.com/mastra-ai/mastra/commit/5d8f8b78460350d581e8a92412cdfe88b4ce76bc), [`1874bf2`](https://github.com/mastra-ai/mastra/commit/1874bf2a5ba304f22ffb93f9ec5a9afea000a5a1), [`8c2d516`](https://github.com/mastra-ai/mastra/commit/8c2d5164714a27e720d898da612da6054a88ef91), [`14b2a7c`](https://github.com/mastra-ai/mastra/commit/14b2a7c56da4329f7fd17738056a081663deed46), [`1874bf2`](https://github.com/mastra-ai/mastra/commit/1874bf2a5ba304f22ffb93f9ec5a9afea000a5a1), [`eb0b702`](https://github.com/mastra-ai/mastra/commit/eb0b702e9939f02073fb1c4dfd7eaa51fde59e0b), [`d93662b`](https://github.com/mastra-ai/mastra/commit/d93662bfee9313c376cff90e910e05ec9b0634ea), [`425d383`](https://github.com/mastra-ai/mastra/commit/425d383d4fb15e55e9491b6bdaebb57f2de7cdc8), [`5d8f8b7`](https://github.com/mastra-ai/mastra/commit/5d8f8b78460350d581e8a92412cdfe88b4ce76bc), [`8c90438`](https://github.com/mastra-ai/mastra/commit/8c90438b404d27593927eccc47616aab4a35006e), [`5d8f8b7`](https://github.com/mastra-ai/mastra/commit/5d8f8b78460350d581e8a92412cdfe88b4ce76bc), [`8c90438`](https://github.com/mastra-ai/mastra/commit/8c90438b404d27593927eccc47616aab4a35006e)]:
  - @mastra/core@1.79.0-alpha.1
  - @mastra/duckdb@1.15.0-alpha.1
  - @mastra/pg@1.32.0-alpha.1
  - @mastra/observability@1.21.0-alpha.1
  - @mastra/libsql@1.27.0-alpha.1
  - @mastra/mcp@2.4.2-alpha.0

## 1.15.0-alpha.0

### Minor Changes

- Added `resolveDefaultThinkingLevel` so a host can supply the thinking level for requests whose session has not picked one. When set, it replaces the settings.json defaults; a session's own level still wins. It runs on every model resolution, including account-rotation hops, so a changed default applies to the next request. ([#27216](https://github.com/mastra-ai/mastra/pull/27216))

  ```ts
  const { controller } = await createMastraCodeAgentController({
    resolveDefaultThinkingLevel: async ({ requestContext }) => lookUpTeamThinkingLevel(requestContext),
  });
  ```

### Patch Changes

- Auto memory now picks Gemini only when Mastra Code can use a Google credential for the request: a stored key or sign-in, or locally a `GOOGLE_GENERATIVE_AI_API_KEY` or `GOOGLE_API_KEY` environment variable. Deployed Factory accounts never use the server's environment keys, so they get a model from a provider they connected. ([#26666](https://github.com/mastra-ai/mastra/pull/26666))

- Bump for npm ([#27221](https://github.com/mastra-ai/mastra/pull/27221))

- Updated dependencies [[`9b60f12`](https://github.com/mastra-ai/mastra/commit/9b60f12b13b28c9664a839aef435e6d10898644d), [`9b60f12`](https://github.com/mastra-ai/mastra/commit/9b60f12b13b28c9664a839aef435e6d10898644d), [`f885386`](https://github.com/mastra-ai/mastra/commit/f885386b79be0e4d784067b0e26608971e0cc788), [`f6a9762`](https://github.com/mastra-ai/mastra/commit/f6a9762b12ae9dad6a154f73ed3099a2ee472d0c), [`12a8a89`](https://github.com/mastra-ai/mastra/commit/12a8a89938ee5dbad91edb5b4da26cd68c95fabd), [`fae54c5`](https://github.com/mastra-ai/mastra/commit/fae54c57917cd1f527937ca42b5ab7dfe1d55a2a)]:
  - @mastra/observability@1.20.2-alpha.0
  - @mastra/core@1.78.1-alpha.0
  - @mastra/memory@1.39.0-alpha.0
  - @mastra/agent-browser@0.5.4-alpha.0
  - @mastra/stagehand@0.3.6-alpha.0
  - @mastra/parallel@0.1.3-alpha.0
  - @mastra/tavily@1.1.3-alpha.0
  - @mastra/fastembed@1.3.4-alpha.0
  - @mastra/mcp@2.4.2-alpha.0
  - @mastra/schema-compat@1.3.16-alpha.0
  - @mastra/github-signals@0.5.2-alpha.0
  - @mastra/duckdb@1.14.2-alpha.0
  - @mastra/libsql@1.26.3-alpha.0
  - @mastra/pg@1.31.3-alpha.0

## 1.14.0

### Minor Changes

- `createMastraCodeAgentController` now accepts `modes: false` for hosts that don't offer modes. Every session runs as the single Build agent: a thread last used in another mode reopens in Build, and per-mode thinking defaults from settings never apply. Runs without a session override use the global thinking level. ([#26854](https://github.com/mastra-ai/mastra/pull/26854))

  ```typescript
  const controller = await createMastraCodeAgentController({ modes: false });
  ```

- You can now remove agent controller built-in tools such as `submit_plan` without reaching into the controller's private config. Set `disableBuiltinTools` on `createMastraCode()` / `prepareAgentControllerMount()`, or on `MastraFactory` to apply it to every Factory session. When `submit_plan` is unavailable, plan mode tells the model to write the plan file instead of calling it. ([#26967](https://github.com/mastra-ai/mastra/pull/26967))

  ```ts
  new MastraFactory({ storage, disableBuiltinTools: ['submit_plan'] });
  ```

- Removed cross-scope credential fallback in deployed sessions so each session uses only Factory or user credentials. ([#26934](https://github.com/mastra-ai/mastra/pull/26934))

  Custom credential store providers must replace `orgFirst` with an explicit `credentialScope`:

  ```ts
  // Before
  const tenant = { orgId, userId, orgFirst: true };

  // After
  const tenant = { orgId, userId, credentialScope: 'factory' as const };
  ```

  Use `"user"` to resolve only personal credentials. Hosts that select credentials for a session owner rather than the signed-in caller can register an asynchronous policy resolver as the second argument to `setCredentialStoreProvider`. Resolve that policy from authenticated identity and durable session records, not client-writable session state. Call `prepareCredentialTenant(requestContext)` before resolving a model; the SDK’s built-in model, memory, and goal-judge resolvers do this automatically and refresh the policy again before provider calls.

### Patch Changes

- Fixed revoked or invalid OAuth sign-ins showing a raw API error. When Anthropic, OpenAI Codex, GitHub Copilot, xAI, or Kimi For Coding rejects a stored sign-in with a 401, the error is now a `ProviderAuthRequiredError` that says the sign-in was rejected, the same as a missing sign-in. Hosts can match on the error name to prompt the user to sign in again. ([#27187](https://github.com/mastra-ai/mastra/pull/27187))

  ```ts
  if (error.name === 'ProviderAuthRequiredError') {
    // e.g. "Anthropic rejected the stored sign-in: OAuth access token is invalid."
    promptSignIn();
  }
  ```

- Improved the "Tenant model credential policy could not be resolved" error. It now states why resolution failed: ([#27138](https://github.com/mastra-ai/mastra/pull/27138))

  - The request has no authenticated user.
  - No credential policy applies to the user.

  Added a warning with non-secret diagnostics and a stack trace. Use it to locate where the request context was lost.

- Fixed model selection for Kimi For Coding, GitHub Copilot and custom providers in `/models`, `/setup`, `/model` and `/om`. Picking a Kimi or Copilot model no longer saves an id that fails with "Could not find config for provider mastracode". ([#26692](https://github.com/mastra-ai/mastra/pull/26692))

  These models are now listed under ids that resolve:

  - Kimi: `kimi-code-plan-cn/<model>` (your Kimi login or `KIMI_API_KEY` authenticates it)
  - GitHub Copilot: `github-copilot/<model>`
  - Custom providers: `<custom-provider>/<model>`

  Ids you already saved keep working: `kimi-for-coding/<model>`, `mastracode/kimi-for-coding/<model>` and `mastracode/github-copilot/<model>`.

  A Kimi API key saved in `/api-keys` or Factory's provider settings is now used for Kimi models, and a Kimi login shows as connected in `/api-keys`.

- Kept sandbox-backed file reads, listings and searches complete now that sandbox commands keep only the newest 1 MiB of output by default. ([#27106](https://github.com/mastra-ai/mastra/pull/27106))

- Fixed the thinking level being ignored by more providers. It now reaches Groq, Mistral, xAI, OpenRouter, Together AI, DeepInfra, Cerebras, Perplexity and Alibaba models. ([#26411](https://github.com/mastra-ai/mastra/pull/26411))

  The thinking picker lists only the levels a model's request can carry. For example, GLM-5.2 through Mistral tops out at High instead of failing the request on Max. Models whose requests cannot carry a level now offer only Off instead of levels that did nothing. That includes Z.ai, Kimi, GitHub Copilot and Amazon Bedrock models. Off still leaves each model on its own default.

- Fixed the missing provider credential error to say which credentials the Factory uses. It now names the Factory's model scope (organization or personal credentials only), notes that the other set doesn't apply, and says what to add. ([#27077](https://github.com/mastra-ai/mastra/pull/27077))

- Updated dependencies [[`0b1ea6c`](https://github.com/mastra-ai/mastra/commit/0b1ea6ca6266158316defb522feb3d2f9bf33174), [`bed1ccc`](https://github.com/mastra-ai/mastra/commit/bed1cccea5817d68faa42a15fda3a0b329f70680), [`bed1ccc`](https://github.com/mastra-ai/mastra/commit/bed1cccea5817d68faa42a15fda3a0b329f70680), [`c6230e3`](https://github.com/mastra-ai/mastra/commit/c6230e30f76b4b912bad68f426d730da1cb67d83), [`a9b85ba`](https://github.com/mastra-ai/mastra/commit/a9b85ba48a2542c568d91f3032464057227d55dc), [`6f50db8`](https://github.com/mastra-ai/mastra/commit/6f50db8a3e0a673c6e094229e3d18e2b8dbb99f7), [`f28c44e`](https://github.com/mastra-ai/mastra/commit/f28c44ed98a87c6078a3e3e9ef2b197d97f97956), [`3ddf32d`](https://github.com/mastra-ai/mastra/commit/3ddf32da0e6eaffd1e5da33105bf245b6e56a117), [`03646c5`](https://github.com/mastra-ai/mastra/commit/03646c587b915ced4c9fad3189391909a296f441), [`eb71f8c`](https://github.com/mastra-ai/mastra/commit/eb71f8c3abbe9aa40375f898fce60f555ef9ebf3), [`02e2eae`](https://github.com/mastra-ai/mastra/commit/02e2eae3aee1c5b5b9c807a6a3389b88eca1440c), [`7b08a87`](https://github.com/mastra-ai/mastra/commit/7b08a876b1060cf6842c61ed8af0eaa93e1310c4), [`5d82145`](https://github.com/mastra-ai/mastra/commit/5d82145ae3cc591eb5cdafd4af5977c36fec5c01), [`7e4b680`](https://github.com/mastra-ai/mastra/commit/7e4b68035c3e62a4fcf981afce9b02ecf65ddcf5), [`032a92d`](https://github.com/mastra-ai/mastra/commit/032a92d661696b3620ce45f4a0b1de60f0a6c068), [`1c9cb41`](https://github.com/mastra-ai/mastra/commit/1c9cb4151c3addfdf689ee1dd9d3a013c7342e25), [`460b600`](https://github.com/mastra-ai/mastra/commit/460b600abe3b7563537cfb8a676d649c638a9190), [`2362057`](https://github.com/mastra-ai/mastra/commit/2362057cedc6b90b9fd71c424df40eedf3a4ecf3), [`9daf547`](https://github.com/mastra-ai/mastra/commit/9daf547f810df721eaca9c9dafc18f8ce1727b77), [`d79c57b`](https://github.com/mastra-ai/mastra/commit/d79c57b6fcb4d61d50fb255724e3d9364a661601), [`5faebef`](https://github.com/mastra-ai/mastra/commit/5faebef77012b31d2062e266a27718ca35ac738d), [`2eefb56`](https://github.com/mastra-ai/mastra/commit/2eefb565fd524acbc5105ddecd9d4f2a0f1deb2f), [`f738a12`](https://github.com/mastra-ai/mastra/commit/f738a120225329f619211756d69f164a3f434c5d), [`eb71f8c`](https://github.com/mastra-ai/mastra/commit/eb71f8c3abbe9aa40375f898fce60f555ef9ebf3), [`4c29655`](https://github.com/mastra-ai/mastra/commit/4c296551a79bebc6a40fddcf2409824f601e6c43), [`843d441`](https://github.com/mastra-ai/mastra/commit/843d4411284c3b96953edebd2c22c3ac9556bac2), [`33eb344`](https://github.com/mastra-ai/mastra/commit/33eb344ebfe918d032e3ad1e410788d4c8bc6526), [`6155190`](https://github.com/mastra-ai/mastra/commit/6155190d2436d5e93e21f6a875d8c4306c8043ff), [`5d12fbf`](https://github.com/mastra-ai/mastra/commit/5d12fbfcd756e5f5b0cae53e45a486a64ad102f5), [`eb71f8c`](https://github.com/mastra-ai/mastra/commit/eb71f8c3abbe9aa40375f898fce60f555ef9ebf3), [`6ea5f80`](https://github.com/mastra-ai/mastra/commit/6ea5f80919ae4ebc3e3fbba29390da74f043c69a), [`2362057`](https://github.com/mastra-ai/mastra/commit/2362057cedc6b90b9fd71c424df40eedf3a4ecf3), [`35fbdce`](https://github.com/mastra-ai/mastra/commit/35fbdce6de71332246dd6d9b4a5ecba2d87fb6cc), [`e496762`](https://github.com/mastra-ai/mastra/commit/e49676258181017f50eb5739d4a97c0da7317dd9), [`d7bd3cd`](https://github.com/mastra-ai/mastra/commit/d7bd3cda0fb2e46c68d164af2e0cb1815be03572), [`cb015a1`](https://github.com/mastra-ai/mastra/commit/cb015a1be6560cbaf4deaef219cb02e63b263bc3), [`9cf0fe4`](https://github.com/mastra-ai/mastra/commit/9cf0fe4731d6186be20c890dba27ba3a2c134f5e), [`c09fb4b`](https://github.com/mastra-ai/mastra/commit/c09fb4b5758114c8c57d0af48cbe6dfdfe9dde90), [`b2dd0c6`](https://github.com/mastra-ai/mastra/commit/b2dd0c6333691467e61406ac920eb6f861db6bc0), [`ad16eae`](https://github.com/mastra-ai/mastra/commit/ad16eae7eec9af386c9eee81f4f30ef65d0df48b), [`d99fa30`](https://github.com/mastra-ai/mastra/commit/d99fa305e0baa00fb2064283658c10e00b95bf10), [`4fe06e4`](https://github.com/mastra-ai/mastra/commit/4fe06e46bee723d7505947827e85745b468b0ca8), [`f15bef1`](https://github.com/mastra-ai/mastra/commit/f15bef1e81cff6ca977d336f3bc325e47b6359b5)]:
  - @mastra/core@1.78.0
  - @mastra/observability@1.20.1
  - @mastra/schema-compat@1.3.15
  - @mastra/duckdb@1.14.1
  - @mastra/pg@1.31.2
  - @mastra/libsql@1.26.2
  - @mastra/mcp@2.4.1
  - @mastra/memory@1.38.0

## 1.14.0-alpha.9

### Patch Changes

- Fixed revoked or invalid OAuth sign-ins showing a raw API error. When Anthropic, OpenAI Codex, GitHub Copilot, xAI, or Kimi For Coding rejects a stored sign-in with a 401, the error is now a `ProviderAuthRequiredError` that says the sign-in was rejected, the same as a missing sign-in. Hosts can match on the error name to prompt the user to sign in again. ([#27187](https://github.com/mastra-ai/mastra/pull/27187))

  ```ts
  if (error.name === 'ProviderAuthRequiredError') {
    // e.g. "Anthropic rejected the stored sign-in: OAuth access token is invalid."
    promptSignIn();
  }
  ```

- Updated dependencies [[`a9b85ba`](https://github.com/mastra-ai/mastra/commit/a9b85ba48a2542c568d91f3032464057227d55dc), [`f28c44e`](https://github.com/mastra-ai/mastra/commit/f28c44ed98a87c6078a3e3e9ef2b197d97f97956)]:
  - @mastra/core@1.78.0-alpha.9

## 1.14.0-alpha.8

### Patch Changes

- Updated dependencies [[`03646c5`](https://github.com/mastra-ai/mastra/commit/03646c587b915ced4c9fad3189391909a296f441), [`d7bd3cd`](https://github.com/mastra-ai/mastra/commit/d7bd3cda0fb2e46c68d164af2e0cb1815be03572)]:
  - @mastra/core@1.78.0-alpha.8

## 1.14.0-alpha.7

### Patch Changes

- Improved the "Tenant model credential policy could not be resolved" error. It now states why resolution failed: ([#27138](https://github.com/mastra-ai/mastra/pull/27138))

  - The request has no authenticated user.
  - No credential policy applies to the user.

  Added a warning with non-secret diagnostics and a stack trace. Use it to locate where the request context was lost.

- Updated dependencies [[`7e4b680`](https://github.com/mastra-ai/mastra/commit/7e4b68035c3e62a4fcf981afce9b02ecf65ddcf5), [`9cf0fe4`](https://github.com/mastra-ai/mastra/commit/9cf0fe4731d6186be20c890dba27ba3a2c134f5e)]:
  - @mastra/core@1.78.0-alpha.7

## 1.14.0-alpha.6

### Patch Changes

- Updated dependencies [[`6f50db8`](https://github.com/mastra-ai/mastra/commit/6f50db8a3e0a673c6e094229e3d18e2b8dbb99f7), [`3ddf32d`](https://github.com/mastra-ai/mastra/commit/3ddf32da0e6eaffd1e5da33105bf245b6e56a117), [`032a92d`](https://github.com/mastra-ai/mastra/commit/032a92d661696b3620ce45f4a0b1de60f0a6c068), [`1c9cb41`](https://github.com/mastra-ai/mastra/commit/1c9cb4151c3addfdf689ee1dd9d3a013c7342e25), [`2eefb56`](https://github.com/mastra-ai/mastra/commit/2eefb565fd524acbc5105ddecd9d4f2a0f1deb2f)]:
  - @mastra/core@1.78.0-alpha.6
  - @mastra/mcp@2.4.1-alpha.1

## 1.14.0-alpha.5

### Patch Changes

- Kept sandbox-backed file reads, listings and searches complete now that sandbox commands keep only the newest 1 MiB of output by default. ([#27106](https://github.com/mastra-ai/mastra/pull/27106))

- Updated dependencies [[`f738a12`](https://github.com/mastra-ai/mastra/commit/f738a120225329f619211756d69f164a3f434c5d)]:
  - @mastra/core@1.78.0-alpha.5

## 1.14.0-alpha.4

### Patch Changes

- Updated dependencies [[`843d441`](https://github.com/mastra-ai/mastra/commit/843d4411284c3b96953edebd2c22c3ac9556bac2), [`6ea5f80`](https://github.com/mastra-ai/mastra/commit/6ea5f80919ae4ebc3e3fbba29390da74f043c69a)]:
  - @mastra/core@1.78.0-alpha.4

## 1.14.0-alpha.3

### Minor Changes

- You can now remove agent controller built-in tools such as `submit_plan` without reaching into the controller's private config. Set `disableBuiltinTools` on `createMastraCode()` / `prepareAgentControllerMount()`, or on `MastraFactory` to apply it to every Factory session. When `submit_plan` is unavailable, plan mode tells the model to write the plan file instead of calling it. ([#26967](https://github.com/mastra-ai/mastra/pull/26967))

  ```ts
  new MastraFactory({ storage, disableBuiltinTools: ['submit_plan'] });
  ```

### Patch Changes

- Fixed the missing provider credential error to say which credentials the Factory uses. It now names the Factory's model scope (organization or personal credentials only), notes that the other set doesn't apply, and says what to add. ([#27077](https://github.com/mastra-ai/mastra/pull/27077))

- Updated dependencies [[`c6230e3`](https://github.com/mastra-ai/mastra/commit/c6230e30f76b4b912bad68f426d730da1cb67d83), [`eb71f8c`](https://github.com/mastra-ai/mastra/commit/eb71f8c3abbe9aa40375f898fce60f555ef9ebf3), [`7b08a87`](https://github.com/mastra-ai/mastra/commit/7b08a876b1060cf6842c61ed8af0eaa93e1310c4), [`5d82145`](https://github.com/mastra-ai/mastra/commit/5d82145ae3cc591eb5cdafd4af5977c36fec5c01), [`eb71f8c`](https://github.com/mastra-ai/mastra/commit/eb71f8c3abbe9aa40375f898fce60f555ef9ebf3), [`4c29655`](https://github.com/mastra-ai/mastra/commit/4c296551a79bebc6a40fddcf2409824f601e6c43), [`6155190`](https://github.com/mastra-ai/mastra/commit/6155190d2436d5e93e21f6a875d8c4306c8043ff), [`eb71f8c`](https://github.com/mastra-ai/mastra/commit/eb71f8c3abbe9aa40375f898fce60f555ef9ebf3), [`35fbdce`](https://github.com/mastra-ai/mastra/commit/35fbdce6de71332246dd6d9b4a5ecba2d87fb6cc), [`cb015a1`](https://github.com/mastra-ai/mastra/commit/cb015a1be6560cbaf4deaef219cb02e63b263bc3), [`d99fa30`](https://github.com/mastra-ai/mastra/commit/d99fa305e0baa00fb2064283658c10e00b95bf10), [`f15bef1`](https://github.com/mastra-ai/mastra/commit/f15bef1e81cff6ca977d336f3bc325e47b6359b5)]:
  - @mastra/schema-compat@1.3.15-alpha.0
  - @mastra/duckdb@1.14.1-alpha.0
  - @mastra/core@1.78.0-alpha.3
  - @mastra/pg@1.31.2-alpha.1
  - @mastra/memory@1.38.0-alpha.0
  - @mastra/mcp@2.4.1-alpha.0

## 1.14.0-alpha.2

### Minor Changes

- Removed cross-scope credential fallback in deployed sessions so each session uses only Factory or user credentials. ([#26934](https://github.com/mastra-ai/mastra/pull/26934))

  Custom credential store providers must replace `orgFirst` with an explicit `credentialScope`:

  ```ts
  // Before
  const tenant = { orgId, userId, orgFirst: true };

  // After
  const tenant = { orgId, userId, credentialScope: 'factory' as const };
  ```

  Use `"user"` to resolve only personal credentials. Hosts that select credentials for a session owner rather than the signed-in caller can register an asynchronous policy resolver as the second argument to `setCredentialStoreProvider`. Resolve that policy from authenticated identity and durable session records, not client-writable session state. Call `prepareCredentialTenant(requestContext)` before resolving a model; the SDK’s built-in model, memory, and goal-judge resolvers do this automatically and refresh the policy again before provider calls.

### Patch Changes

- Updated dependencies [[`460b600`](https://github.com/mastra-ai/mastra/commit/460b600abe3b7563537cfb8a676d649c638a9190), [`2362057`](https://github.com/mastra-ai/mastra/commit/2362057cedc6b90b9fd71c424df40eedf3a4ecf3), [`9daf547`](https://github.com/mastra-ai/mastra/commit/9daf547f810df721eaca9c9dafc18f8ce1727b77), [`2362057`](https://github.com/mastra-ai/mastra/commit/2362057cedc6b90b9fd71c424df40eedf3a4ecf3), [`e496762`](https://github.com/mastra-ai/mastra/commit/e49676258181017f50eb5739d4a97c0da7317dd9)]:
  - @mastra/core@1.78.0-alpha.2
  - @mastra/observability@1.20.1-alpha.1
  - @mastra/mcp@2.4.1-alpha.0

## 1.14.0-alpha.1

### Minor Changes

- `createMastraCodeAgentController` now accepts `modes: false` for hosts that don't offer modes. Every session runs as the single Build agent: a thread last used in another mode reopens in Build, and per-mode thinking defaults from settings never apply. Runs without a session override use the global thinking level. ([#26854](https://github.com/mastra-ai/mastra/pull/26854))

  ```typescript
  const controller = await createMastraCodeAgentController({ modes: false });
  ```

### Patch Changes

- Fixed model selection for Kimi For Coding, GitHub Copilot and custom providers in `/models`, `/setup`, `/model` and `/om`. Picking a Kimi or Copilot model no longer saves an id that fails with "Could not find config for provider mastracode". ([#26692](https://github.com/mastra-ai/mastra/pull/26692))

  These models are now listed under ids that resolve:

  - Kimi: `kimi-code-plan-cn/<model>` (your Kimi login or `KIMI_API_KEY` authenticates it)
  - GitHub Copilot: `github-copilot/<model>`
  - Custom providers: `<custom-provider>/<model>`

  Ids you already saved keep working: `kimi-for-coding/<model>`, `mastracode/kimi-for-coding/<model>` and `mastracode/github-copilot/<model>`.

  A Kimi API key saved in `/api-keys` or Factory's provider settings is now used for Kimi models, and a Kimi login shows as connected in `/api-keys`.

- Fixed the thinking level being ignored by more providers. It now reaches Groq, Mistral, xAI, OpenRouter, Together AI, DeepInfra, Cerebras, Perplexity and Alibaba models. ([#26411](https://github.com/mastra-ai/mastra/pull/26411))

  The thinking picker lists only the levels a model's request can carry. For example, GLM-5.2 through Mistral tops out at High instead of failing the request on Max. Models whose requests cannot carry a level now offer only Off instead of levels that did nothing. That includes Z.ai, Kimi, GitHub Copilot and Amazon Bedrock models. Off still leaves each model on its own default.

- Updated dependencies [[`bed1ccc`](https://github.com/mastra-ai/mastra/commit/bed1cccea5817d68faa42a15fda3a0b329f70680), [`bed1ccc`](https://github.com/mastra-ai/mastra/commit/bed1cccea5817d68faa42a15fda3a0b329f70680), [`02e2eae`](https://github.com/mastra-ai/mastra/commit/02e2eae3aee1c5b5b9c807a6a3389b88eca1440c), [`d79c57b`](https://github.com/mastra-ai/mastra/commit/d79c57b6fcb4d61d50fb255724e3d9364a661601), [`5faebef`](https://github.com/mastra-ai/mastra/commit/5faebef77012b31d2062e266a27718ca35ac738d), [`b2dd0c6`](https://github.com/mastra-ai/mastra/commit/b2dd0c6333691467e61406ac920eb6f861db6bc0), [`ad16eae`](https://github.com/mastra-ai/mastra/commit/ad16eae7eec9af386c9eee81f4f30ef65d0df48b), [`4fe06e4`](https://github.com/mastra-ai/mastra/commit/4fe06e46bee723d7505947827e85745b468b0ca8)]:
  - @mastra/observability@1.20.1-alpha.0
  - @mastra/core@1.78.0-alpha.1
  - @mastra/pg@1.31.2-alpha.0
  - @mastra/libsql@1.26.2-alpha.0
  - @mastra/mcp@2.4.1-alpha.0

## 1.13.1-alpha.0

### Patch Changes

- Updated dependencies [[`0b1ea6c`](https://github.com/mastra-ai/mastra/commit/0b1ea6ca6266158316defb522feb3d2f9bf33174), [`33eb344`](https://github.com/mastra-ai/mastra/commit/33eb344ebfe918d032e3ad1e410788d4c8bc6526), [`5d12fbf`](https://github.com/mastra-ai/mastra/commit/5d12fbfcd756e5f5b0cae53e45a486a64ad102f5)]:
  - @mastra/core@1.78.0-alpha.0

## 1.13.0

### Minor Changes

- The `theme` preference now accepts any theme name, not just `auto`, `dark`, or `light`, so callers can persist bundled and custom theme selections. ([#26719](https://github.com/mastra-ai/mastra/pull/26719))

- Added the `instructionRoots` session state field. A host that checks out several repositories under one working directory lists their directories, and the system prompt loads each one's `AGENTS.md` or `CLAUDE.md` in that order. Without it, instructions load from the working directory as before. ([#26169](https://github.com/mastra-ai/mastra/pull/26169))

  ```ts
  await controller.setState({
    projectPath: '/workspace',
    instructionRoots: ['api', 'web'], // loads /workspace/api/AGENTS.md, then /workspace/web/AGENTS.md
  });
  ```

  On an untrusted checkout with a `baseRef`, only the first root loads, from that ref.

### Patch Changes

- Fixed cancellation of pending tool approvals to target the originating run and ignore prompts that have already been resolved. ([#26058](https://github.com/mastra-ai/mastra/pull/26058))

- The default memory from `createMastraCode()` now has a `settled()` method. Await it before closing storage so background memory work, such as buffered observations and their indexing, finishes first. ([#22078](https://github.com/mastra-ai/mastra/pull/22078))

  ```ts
  const { memory, storageMaintenance } = await createMastraCode();
  if (memory && 'settled' in memory) await memory.settled();
  await storageMaintenance?.closeStorage?.();
  ```

- New Mastra Code threads retain a stable local owner identity across sessions. ([#26549](https://github.com/mastra-ai/mastra/pull/26549))

- Updated dependencies [[`54e9dc3`](https://github.com/mastra-ai/mastra/commit/54e9dc3ed0615ee84a6526395a9fefe17320fe7e), [`f8c0ce2`](https://github.com/mastra-ai/mastra/commit/f8c0ce2646427327b63c05d2eb09e76a3b04133e), [`6e5f3b3`](https://github.com/mastra-ai/mastra/commit/6e5f3b392e068550533031fa90474b902d0e10e0), [`eaa9d12`](https://github.com/mastra-ai/mastra/commit/eaa9d12407f4962e94e0d5cd49a643e6e317d60a), [`5a70664`](https://github.com/mastra-ai/mastra/commit/5a7066478c1924a6e9a94e1ba3210f9b67a35535), [`36fc7ea`](https://github.com/mastra-ai/mastra/commit/36fc7eabf79ca70bd489e4022eb39a3d8382ace5), [`3504acd`](https://github.com/mastra-ai/mastra/commit/3504acdb2833b71db61dc9387c0f25f3cd0a3070), [`59164cb`](https://github.com/mastra-ai/mastra/commit/59164cb7f8b298e28e13305b0273ed2ef7f1d9e1), [`2a1bb80`](https://github.com/mastra-ai/mastra/commit/2a1bb80305bca1859504287e1a09f43c8a014330), [`4df792b`](https://github.com/mastra-ai/mastra/commit/4df792b5b9146b5a2d6726193ee82d9db31180a4), [`6a5711c`](https://github.com/mastra-ai/mastra/commit/6a5711cabf8ab5f08296e1cf0e6b4db50fc4b42b), [`0017956`](https://github.com/mastra-ai/mastra/commit/001795671cf329997bee74541f5de9056e6b1cec), [`aa00f41`](https://github.com/mastra-ai/mastra/commit/aa00f41855e8d6802546f613ffec1669e03409fc), [`36fc7ea`](https://github.com/mastra-ai/mastra/commit/36fc7eabf79ca70bd489e4022eb39a3d8382ace5), [`53d95e0`](https://github.com/mastra-ai/mastra/commit/53d95e0d2259a66a7ceaa3cafeb415446507f54c), [`2ec9c07`](https://github.com/mastra-ai/mastra/commit/2ec9c07eddb142c965f1201f5c6e5dbb288405f9), [`e384817`](https://github.com/mastra-ai/mastra/commit/e3848177f2a0051ea1469a06fb6502164bfada7c), [`958bdc9`](https://github.com/mastra-ai/mastra/commit/958bdc942aa78f00c9ec25f8adfb8e14a0dd4fd9), [`519e97f`](https://github.com/mastra-ai/mastra/commit/519e97f624a15362fec7b143dea4eabcff556712), [`e384817`](https://github.com/mastra-ai/mastra/commit/e3848177f2a0051ea1469a06fb6502164bfada7c), [`3504acd`](https://github.com/mastra-ai/mastra/commit/3504acdb2833b71db61dc9387c0f25f3cd0a3070), [`821b8d4`](https://github.com/mastra-ai/mastra/commit/821b8d4253dcac5d8cf886994884e4645899bedc), [`9290b4a`](https://github.com/mastra-ai/mastra/commit/9290b4a0ceda4310abc2514bed0a1beab5adac8f), [`958bdc9`](https://github.com/mastra-ai/mastra/commit/958bdc942aa78f00c9ec25f8adfb8e14a0dd4fd9), [`878e0e2`](https://github.com/mastra-ai/mastra/commit/878e0e2f5adf9669158c7a8a8d67cd8809633c24), [`4659a11`](https://github.com/mastra-ai/mastra/commit/4659a1130842f07364d4778aa360f3cb7877679d), [`aea91e7`](https://github.com/mastra-ai/mastra/commit/aea91e7f3a4fb066bfda96dca670d7d2a766d770), [`380e9f5`](https://github.com/mastra-ai/mastra/commit/380e9f57ea9ba7c37950b989d145b70c03a09a6c), [`2ec9c07`](https://github.com/mastra-ai/mastra/commit/2ec9c07eddb142c965f1201f5c6e5dbb288405f9), [`541ad59`](https://github.com/mastra-ai/mastra/commit/541ad591750910ca99f8ce71cadbf2d0d10d3a04), [`5d15f0f`](https://github.com/mastra-ai/mastra/commit/5d15f0ff79448b455bd499798f6c7da52f2e663f), [`43b8e36`](https://github.com/mastra-ai/mastra/commit/43b8e36c6a9a8b1bcdd3d26e3259bb64674bff79), [`fbf3371`](https://github.com/mastra-ai/mastra/commit/fbf337130ba12f7435fc1784038b50d5cfa396b1), [`4029a96`](https://github.com/mastra-ai/mastra/commit/4029a964848512399f27bca283915d49fd106717), [`8dc4d65`](https://github.com/mastra-ai/mastra/commit/8dc4d65b34aad280c4f6ab265162c4846face7e3), [`36fc7ea`](https://github.com/mastra-ai/mastra/commit/36fc7eabf79ca70bd489e4022eb39a3d8382ace5), [`ca92c02`](https://github.com/mastra-ai/mastra/commit/ca92c02696427baad81dd7a61b049ef37c332452), [`3504acd`](https://github.com/mastra-ai/mastra/commit/3504acdb2833b71db61dc9387c0f25f3cd0a3070), [`5bb6d71`](https://github.com/mastra-ai/mastra/commit/5bb6d711680d17370eacdcdab105e5af69202c5f), [`dab6849`](https://github.com/mastra-ai/mastra/commit/dab6849945ab2a0e4c946f5b31fb6f41b2c1cd7d), [`a14abf8`](https://github.com/mastra-ai/mastra/commit/a14abf8fc97a504f5591ecc6b8c6ab9d899f4d30), [`da87b0a`](https://github.com/mastra-ai/mastra/commit/da87b0a1629d5ffc980b434f70fe60f9445ddb1c), [`cc9b380`](https://github.com/mastra-ai/mastra/commit/cc9b380cba1e0416c6e3ed7647f76e292474e695), [`182f097`](https://github.com/mastra-ai/mastra/commit/182f09745783aa83e42131307085ecf913cfbc38), [`d9da0da`](https://github.com/mastra-ai/mastra/commit/d9da0da5e5d36023469b527f7be55c017634b186), [`097f002`](https://github.com/mastra-ai/mastra/commit/097f00297b0d46aa304eba3a7203248e21d1a70a), [`958bdc9`](https://github.com/mastra-ai/mastra/commit/958bdc942aa78f00c9ec25f8adfb8e14a0dd4fd9), [`4659a11`](https://github.com/mastra-ai/mastra/commit/4659a1130842f07364d4778aa360f3cb7877679d), [`aa00f41`](https://github.com/mastra-ai/mastra/commit/aa00f41855e8d6802546f613ffec1669e03409fc), [`a4e3270`](https://github.com/mastra-ai/mastra/commit/a4e3270322d681bf433ccaa175b513db5b803c95), [`5227c95`](https://github.com/mastra-ai/mastra/commit/5227c95d54d0b4846220530450063f259797b587), [`226823f`](https://github.com/mastra-ai/mastra/commit/226823ffde55e2dcce01f2111a6a35be3f2c9b85), [`67a6b30`](https://github.com/mastra-ai/mastra/commit/67a6b30769f041244f75f9093a181cdf38e1f2e7), [`4659a11`](https://github.com/mastra-ai/mastra/commit/4659a1130842f07364d4778aa360f3cb7877679d), [`4659a11`](https://github.com/mastra-ai/mastra/commit/4659a1130842f07364d4778aa360f3cb7877679d), [`7236b47`](https://github.com/mastra-ai/mastra/commit/7236b472bca9bbc9dddba53f683b15c271350183)]:
  - @mastra/core@1.77.0
  - @mastra/observability@1.20.0
  - @mastra/pg@1.31.1
  - @mastra/mcp@2.4.0
  - @mastra/memory@1.37.1
  - @mastra/libsql@1.26.1
  - @mastra/fastembed@1.3.3
  - @mastra/schema-compat@1.3.14

## 1.13.0-alpha.4

### Minor Changes

- Added the `instructionRoots` session state field. A host that checks out several repositories under one working directory lists their directories, and the system prompt loads each one's `AGENTS.md` or `CLAUDE.md` in that order. Without it, instructions load from the working directory as before. ([#26169](https://github.com/mastra-ai/mastra/pull/26169))

  ```ts
  await controller.setState({
    projectPath: '/workspace',
    instructionRoots: ['api', 'web'], // loads /workspace/api/AGENTS.md, then /workspace/web/AGENTS.md
  });
  ```

  On an untrusted checkout with a `baseRef`, only the first root loads, from that ref.

### Patch Changes

- Updated dependencies [[`f8c0ce2`](https://github.com/mastra-ai/mastra/commit/f8c0ce2646427327b63c05d2eb09e76a3b04133e), [`36fc7ea`](https://github.com/mastra-ai/mastra/commit/36fc7eabf79ca70bd489e4022eb39a3d8382ace5), [`4df792b`](https://github.com/mastra-ai/mastra/commit/4df792b5b9146b5a2d6726193ee82d9db31180a4), [`0017956`](https://github.com/mastra-ai/mastra/commit/001795671cf329997bee74541f5de9056e6b1cec), [`36fc7ea`](https://github.com/mastra-ai/mastra/commit/36fc7eabf79ca70bd489e4022eb39a3d8382ace5), [`53d95e0`](https://github.com/mastra-ai/mastra/commit/53d95e0d2259a66a7ceaa3cafeb415446507f54c), [`2ec9c07`](https://github.com/mastra-ai/mastra/commit/2ec9c07eddb142c965f1201f5c6e5dbb288405f9), [`9290b4a`](https://github.com/mastra-ai/mastra/commit/9290b4a0ceda4310abc2514bed0a1beab5adac8f), [`380e9f5`](https://github.com/mastra-ai/mastra/commit/380e9f57ea9ba7c37950b989d145b70c03a09a6c), [`2ec9c07`](https://github.com/mastra-ai/mastra/commit/2ec9c07eddb142c965f1201f5c6e5dbb288405f9), [`4029a96`](https://github.com/mastra-ai/mastra/commit/4029a964848512399f27bca283915d49fd106717), [`36fc7ea`](https://github.com/mastra-ai/mastra/commit/36fc7eabf79ca70bd489e4022eb39a3d8382ace5), [`ca92c02`](https://github.com/mastra-ai/mastra/commit/ca92c02696427baad81dd7a61b049ef37c332452), [`d9da0da`](https://github.com/mastra-ai/mastra/commit/d9da0da5e5d36023469b527f7be55c017634b186), [`a4e3270`](https://github.com/mastra-ai/mastra/commit/a4e3270322d681bf433ccaa175b513db5b803c95), [`67a6b30`](https://github.com/mastra-ai/mastra/commit/67a6b30769f041244f75f9093a181cdf38e1f2e7)]:
  - @mastra/core@1.77.0-alpha.4
  - @mastra/pg@1.31.1-alpha.1
  - @mastra/memory@1.37.1-alpha.3
  - @mastra/libsql@1.26.1-alpha.1
  - @mastra/observability@1.20.0-alpha.1
  - @mastra/schema-compat@1.3.14-alpha.0
  - @mastra/mcp@2.4.0-alpha.0

## 1.13.0-alpha.3

### Minor Changes

- The `theme` preference now accepts any theme name, not just `auto`, `dark`, or `light`, so callers can persist bundled and custom theme selections. ([#26719](https://github.com/mastra-ai/mastra/pull/26719))

### Patch Changes

- New Mastra Code threads retain a stable local owner identity across sessions. ([#26549](https://github.com/mastra-ai/mastra/pull/26549))

- Updated dependencies [[`54e9dc3`](https://github.com/mastra-ai/mastra/commit/54e9dc3ed0615ee84a6526395a9fefe17320fe7e), [`59164cb`](https://github.com/mastra-ai/mastra/commit/59164cb7f8b298e28e13305b0273ed2ef7f1d9e1), [`aa00f41`](https://github.com/mastra-ai/mastra/commit/aa00f41855e8d6802546f613ffec1669e03409fc), [`8dc4d65`](https://github.com/mastra-ai/mastra/commit/8dc4d65b34aad280c4f6ab265162c4846face7e3), [`aa00f41`](https://github.com/mastra-ai/mastra/commit/aa00f41855e8d6802546f613ffec1669e03409fc), [`226823f`](https://github.com/mastra-ai/mastra/commit/226823ffde55e2dcce01f2111a6a35be3f2c9b85)]:
  - @mastra/core@1.77.0-alpha.3

## 1.12.1-alpha.2

### Patch Changes

- Fixed cancellation of pending tool approvals to target the originating run and ignore prompts that have already been resolved. ([#26058](https://github.com/mastra-ai/mastra/pull/26058))

- Updated dependencies [[`2a1bb80`](https://github.com/mastra-ai/mastra/commit/2a1bb80305bca1859504287e1a09f43c8a014330), [`519e97f`](https://github.com/mastra-ai/mastra/commit/519e97f624a15362fec7b143dea4eabcff556712), [`aea91e7`](https://github.com/mastra-ai/mastra/commit/aea91e7f3a4fb066bfda96dca670d7d2a766d770), [`da87b0a`](https://github.com/mastra-ai/mastra/commit/da87b0a1629d5ffc980b434f70fe60f9445ddb1c), [`182f097`](https://github.com/mastra-ai/mastra/commit/182f09745783aa83e42131307085ecf913cfbc38), [`7236b47`](https://github.com/mastra-ai/mastra/commit/7236b472bca9bbc9dddba53f683b15c271350183)]:
  - @mastra/core@1.77.0-alpha.2
  - @mastra/memory@1.37.1-alpha.2

## 1.12.1-alpha.1

### Patch Changes

- Updated dependencies [[`6e5f3b3`](https://github.com/mastra-ai/mastra/commit/6e5f3b392e068550533031fa90474b902d0e10e0), [`3504acd`](https://github.com/mastra-ai/mastra/commit/3504acdb2833b71db61dc9387c0f25f3cd0a3070), [`6a5711c`](https://github.com/mastra-ai/mastra/commit/6a5711cabf8ab5f08296e1cf0e6b4db50fc4b42b), [`e384817`](https://github.com/mastra-ai/mastra/commit/e3848177f2a0051ea1469a06fb6502164bfada7c), [`e384817`](https://github.com/mastra-ai/mastra/commit/e3848177f2a0051ea1469a06fb6502164bfada7c), [`3504acd`](https://github.com/mastra-ai/mastra/commit/3504acdb2833b71db61dc9387c0f25f3cd0a3070), [`821b8d4`](https://github.com/mastra-ai/mastra/commit/821b8d4253dcac5d8cf886994884e4645899bedc), [`878e0e2`](https://github.com/mastra-ai/mastra/commit/878e0e2f5adf9669158c7a8a8d67cd8809633c24), [`541ad59`](https://github.com/mastra-ai/mastra/commit/541ad591750910ca99f8ce71cadbf2d0d10d3a04), [`3504acd`](https://github.com/mastra-ai/mastra/commit/3504acdb2833b71db61dc9387c0f25f3cd0a3070), [`5bb6d71`](https://github.com/mastra-ai/mastra/commit/5bb6d711680d17370eacdcdab105e5af69202c5f), [`dab6849`](https://github.com/mastra-ai/mastra/commit/dab6849945ab2a0e4c946f5b31fb6f41b2c1cd7d), [`5227c95`](https://github.com/mastra-ai/mastra/commit/5227c95d54d0b4846220530450063f259797b587)]:
  - @mastra/observability@1.20.0-alpha.0
  - @mastra/mcp@2.4.0-alpha.0
  - @mastra/memory@1.37.1-alpha.1
  - @mastra/core@1.77.0-alpha.1

## 1.12.1-alpha.0

### Patch Changes

- The default memory from `createMastraCode()` now has a `settled()` method. Await it before closing storage so background memory work, such as buffered observations and their indexing, finishes first. ([#22078](https://github.com/mastra-ai/mastra/pull/22078))

  ```ts
  const { memory, storageMaintenance } = await createMastraCode();
  if (memory && 'settled' in memory) await memory.settled();
  await storageMaintenance?.closeStorage?.();
  ```

- Updated dependencies [[`eaa9d12`](https://github.com/mastra-ai/mastra/commit/eaa9d12407f4962e94e0d5cd49a643e6e317d60a), [`958bdc9`](https://github.com/mastra-ai/mastra/commit/958bdc942aa78f00c9ec25f8adfb8e14a0dd4fd9), [`958bdc9`](https://github.com/mastra-ai/mastra/commit/958bdc942aa78f00c9ec25f8adfb8e14a0dd4fd9), [`4659a11`](https://github.com/mastra-ai/mastra/commit/4659a1130842f07364d4778aa360f3cb7877679d), [`5d15f0f`](https://github.com/mastra-ai/mastra/commit/5d15f0ff79448b455bd499798f6c7da52f2e663f), [`43b8e36`](https://github.com/mastra-ai/mastra/commit/43b8e36c6a9a8b1bcdd3d26e3259bb64674bff79), [`fbf3371`](https://github.com/mastra-ai/mastra/commit/fbf337130ba12f7435fc1784038b50d5cfa396b1), [`a14abf8`](https://github.com/mastra-ai/mastra/commit/a14abf8fc97a504f5591ecc6b8c6ab9d899f4d30), [`cc9b380`](https://github.com/mastra-ai/mastra/commit/cc9b380cba1e0416c6e3ed7647f76e292474e695), [`958bdc9`](https://github.com/mastra-ai/mastra/commit/958bdc942aa78f00c9ec25f8adfb8e14a0dd4fd9), [`4659a11`](https://github.com/mastra-ai/mastra/commit/4659a1130842f07364d4778aa360f3cb7877679d), [`4659a11`](https://github.com/mastra-ai/mastra/commit/4659a1130842f07364d4778aa360f3cb7877679d), [`4659a11`](https://github.com/mastra-ai/mastra/commit/4659a1130842f07364d4778aa360f3cb7877679d)]:
  - @mastra/core@1.77.0-alpha.0
  - @mastra/memory@1.37.1-alpha.0
  - @mastra/fastembed@1.3.3-alpha.0
  - @mastra/pg@1.31.1-alpha.0
  - @mastra/libsql@1.26.1-alpha.0

## 1.12.0

### Minor Changes

- Added `runThinkingLevel` to `@mastra/code-sdk/thinking`. It returns the thinking level a request actually sends for a model, using the reasoning options models.dev publishes. `getAvailableThinkingLevelsForModel` takes the same options and lists only levels that send a different request. ([#26229](https://github.com/mastra-ai/mastra/pull/26229))

  ```ts
  import { getModelReasoningOptions } from '@mastra/core/llm';
  import { getAvailableThinkingLevelsForModel, runThinkingLevel } from '@mastra/code-sdk/thinking';

  const options = getModelReasoningOptions('openai/gpt-5');
  runThinkingLevel('openai/gpt-5', 'max', options); // 'high'
  getAvailableThinkingLevelsForModel('openai/gpt-5', options); // ['off', 'low', 'medium', 'high']
  ```

  Fixed GPT-5 requests at Extra high or Max thinking. They sent `xhigh`, an effort models.dev does not list for the model, and now send `high`.

  Models that models.dev lists without reasoning controls, such as GPT-4o, now run every level as `off`, so GPT-4o requests no longer carry a reasoning effort. Claude and Gemini models keep the levels their thinking settings send.

- Added a `--pack <id>` flag to headless mode (`mastracode -p ... --pack anthropic`). It resolves builtin pack ids and saved custom packs (`custom:<name>` or bare name), exits with the list of valid packs on unknown ids, and applies the pack like `/models` → Activate: mode models, subagent models, model route, and thread `activeModelPackId`. An explicit `--model` still wins over the pack for the active mode. ([#26691](https://github.com/mastra-ai/mastra/pull/26691))

  **Example**

  ```bash
  mastracode -p "summarize this repo" --pack anthropic
  mastracode -p "fix the tests" --pack Kimi --model openai/gpt-5.5
  ```

- Replaced the quiet mode settings with a single `previewLines` preference, since compact rendering is now the only Mastra Code display mode. ([#26576](https://github.com/mastra-ai/mastra/pull/26576))

  `GlobalSettings` no longer has `preferences.quietMode`, `preferences.quietModeMaxToolPreviewLines` or `onboarding.quietModePreferenceSelected`. It adds `preferences.previewLines` (0–8, default 2). When settings load and `previewLines` isn't set yet, it is filled in from `quietModeMaxToolPreviewLines` and saved. The legacy keys stay in the file unchanged.

  ```ts
  // Before
  const lines = settings.preferences.quietModeMaxToolPreviewLines;

  // After
  const lines = settings.preferences.previewLines;
  ```

- Rearchitected an experimental memory feature. ([#26024](https://github.com/mastra-ai/mastra/pull/26024))

### Patch Changes

- Fixed `agent_signal_send` reporting a signal as failed when it had been saved to the target agent's inbox. For signals that don't require a reply, when direct delivery fails but the notification is still pending, the tool now says the signal was queued, includes the delivery error, and suggests retrying with the same messageId. Signals sent with `expectsReply: true` still return an error in this case, because the reply obligation was not established. ([#26292](https://github.com/mastra-ai/mastra/pull/26292))

- Fixed DeepSeek models ignoring the thinking level. Max on DeepSeek V4 Pro now asks for maximum effort, and Low asks for low effort. Off still leaves DeepSeek on its own default. ([#26407](https://github.com/mastra-ai/mastra/pull/26407))

- Fixed the update check treating a prerelease, such as `1.2.0-alpha.1`, as already up to date when its stable release (`1.2.0`) is out. `/update`, `mastracode update`, and the startup update notice now offer the stable release. ([#26455](https://github.com/mastra-ai/mastra/pull/26455))

- Factory deployments with sign-in enabled can now use Amazon Bedrock. Opt in on the server, then provide AWS credentials and `AWS_REGION` there. Every signed-in account can then pick Bedrock models without saving a per-account API key. ([#26249](https://github.com/mastra-ai/mastra/pull/26249))

  ```ts
  new MastraFactory({
    // ...
    deploymentModelProviders: ['amazon-bedrock'],
  });
  ```

  The web deployment reads the same list from `FACTORY_DEPLOYMENT_MODEL_PROVIDERS=amazon-bedrock`.

  Without the opt-in, Bedrock stays hidden from signed-in accounts and runs fail with a `ProviderAuthRequiredError`. Before this change, a run could silently fall back to whatever AWS credentials the server had.

- Improved Mastra Code observational memory so automatic Observer and Reflector roles follow the active main model provider while explicit role choices stay pinned. ([#24508](https://github.com/mastra-ai/mastra/pull/24508))

- The built-in OpenAI Observational Memory pack now uses `openai/gpt-6-luna` instead of `openai/gpt-5.4-mini`. ([#24508](https://github.com/mastra-ai/mastra/pull/24508))

- Fixed per-agent-type subagent model selections (`subagentModelId_explore/plan/execute`) being stripped from session state by schema validation. Pack activation (`/models` → Activate or `--pack`) assigned subagent models, but the next session state update silently dropped them, so subagents fell back to their default models. ([#26691](https://github.com/mastra-ai/mastra/pull/26691))

- Fixed restarted Mastra Code sessions staying unreachable to other agents for up to about 13 seconds. A session that was shutting down kept its threads claimed until it fully exited, and the restarted session waited up to 5 seconds between attempts to claim them. Shutdown in the TUI, headless mode and ACP now releases thread claims first, so a restarted session is reachable again within about a second. Retries are also capped at 1 second. ([#26292](https://github.com/mastra-ai/mastra/pull/26292))

  Embedders that shut down a `createMastraCode()` result themselves can call the new `releaseThreadClaims()` at the start of their teardown:

  ```ts
  const mastraCode = await createMastraCode(config);

  // On shutdown, before stopping workers and closing storage:
  mastraCode.releaseThreadClaims();
  ```

- Removed the "Starting on <account>" notice that was emitted at the start of each turn when using subscription accounts. Preferred-account routing is unchanged. ([#25937](https://github.com/mastra-ai/mastra/pull/25937))

- Factory observational memory now supports automatic model selection per role. `PUT /web/config/om/:role/model` accepts `modelId: 'auto'` to clear that role back to automatic selection, and any other value to pin it. Previously `'auto'` was stored as if it were a model name, which pinned the role to a model that does not exist; automatic roles are now stored as `null` and follow the active main model on every run. The request body is unchanged, so existing callers keep working. ([#24508](https://github.com/mastra-ai/mastra/pull/24508))

  Connecting a model provider or signing in over ACP no longer writes observer or reflector selections, and the unused `POST /web/config/om/provider-defaults` route was removed. Stored settings are applied per run instead of being copied into session state. Settings responses now report each role's intent, its effective model, and whether that model's provider is currently available; `mastra/` models count as available when the Mastra gateway key is configured. If Factory cannot load the saved settings for a run, memory falls back to Auto models and default thresholds, and the thread shows an error explaining that saved choices were not applied.

  `MastraCodeConfig.inputProcessors` also accepts a function of `{ requestContext }`, so hosts can choose input processors per request:

  ```ts
  await createMastraCodeAgentController({
    inputProcessors: ({ requestContext }) => (requestContext.get('channel') ? [channelProcessor] : []),
  });
  ```

  The server now prevents request payloads from overriding Factory's internal memory-settings context.

- Update results now include their parts as separate fields (`via`, `command`, `details`, `installDir`, `runningVersion`, `ranWith`, `managedBy`) alongside `message`, so callers can lay them out. ([#26455](https://github.com/mastra-ai/mastra/pull/26455))

  Added `planUpdate(pm, version)`, which decides how an update will run without changing anything: an install (with the tool and command), or no install with the result to show instead, for example when Homebrew owns the install. `performUpdate` follows the same plan, and accepts one you already showed the user:

  ```ts
  const plan = await planUpdate(pm, latestVersion);
  if (plan.willInstall) {
    console.log(`Installing with ${plan.via}: ${plan.command}`);
    const outcome = await performUpdate(pm, latestVersion, plan);
  }
  ```

- Updated dependencies [[`908f923`](https://github.com/mastra-ai/mastra/commit/908f92340e14f776d7a69edab244d0ae3cefe057), [`b196f30`](https://github.com/mastra-ai/mastra/commit/b196f30602005325e95bde29a9b7676aeea14c42), [`a65d0c7`](https://github.com/mastra-ai/mastra/commit/a65d0c788824081f36ccd95078a8d1214ff687c4), [`4b8f1d7`](https://github.com/mastra-ai/mastra/commit/4b8f1d74adb2b1742fd10ebb1d24e863329075aa), [`9a511a4`](https://github.com/mastra-ai/mastra/commit/9a511a4ff5ac8349f4d4b64b0f432576fa3c8656), [`2233844`](https://github.com/mastra-ai/mastra/commit/223384452984718e16fc660d29f0d5d93a1ebaf2), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`cca0f8a`](https://github.com/mastra-ai/mastra/commit/cca0f8a543eca15c24be21c8ee43dc46fb7aefae), [`20f7f87`](https://github.com/mastra-ai/mastra/commit/20f7f878953cb0965962d1e83a463be5e4ba2c26), [`65b62c0`](https://github.com/mastra-ai/mastra/commit/65b62c04c28267ab81f7d6b92ed29ce0ef46671b), [`d4e6c7f`](https://github.com/mastra-ai/mastra/commit/d4e6c7fffdef836fc44276509596e78d7d785729), [`b801545`](https://github.com/mastra-ai/mastra/commit/b80154540bf557de296bcb6f068b5117b5d84ef9), [`ed0e355`](https://github.com/mastra-ai/mastra/commit/ed0e355205da51bac4d11b7a9553c95ef1f505f4), [`b93ce2e`](https://github.com/mastra-ai/mastra/commit/b93ce2ee034c6a0be511b717e1e043e875dca677), [`ddb53f2`](https://github.com/mastra-ai/mastra/commit/ddb53f26142ccf6177dec5392b6dc867ce177d15), [`8f51bae`](https://github.com/mastra-ai/mastra/commit/8f51bae55307c62f18d2b69da27270ebdf1f728f), [`6df693a`](https://github.com/mastra-ai/mastra/commit/6df693aa926482422ef447d8db058adef36a594b), [`42a3c74`](https://github.com/mastra-ai/mastra/commit/42a3c748085fee95d4e38e42a4ccbce891ce3e3f), [`21eaa20`](https://github.com/mastra-ai/mastra/commit/21eaa208834ae36721324700023f88cec7cf5c01), [`4580309`](https://github.com/mastra-ai/mastra/commit/45803095e2aed7bf58d878eb206a767b9b0e2489), [`06e428d`](https://github.com/mastra-ai/mastra/commit/06e428d80ccbc54bb74eb6bd6f01a7fd4eddc45f), [`d0db35e`](https://github.com/mastra-ai/mastra/commit/d0db35e00be93f1339525188c102f73dea5867d8), [`b48ddcc`](https://github.com/mastra-ai/mastra/commit/b48ddcc7768c76f02d1dd4ed0f21d417a8b21418), [`578d2c4`](https://github.com/mastra-ai/mastra/commit/578d2c41fc83b13efd88165ff0105904434a6db4), [`b875985`](https://github.com/mastra-ai/mastra/commit/b87598584f0f2b008242ed1f458b7f72ba6d42d1), [`cf6446c`](https://github.com/mastra-ai/mastra/commit/cf6446cae036784bd6802e4bcca8f3cf34a9ca9f), [`a8f39b6`](https://github.com/mastra-ai/mastra/commit/a8f39b629d8bcd6659b61bf71bd5a5dd2f38ed12), [`34844fc`](https://github.com/mastra-ai/mastra/commit/34844fcc7aeff1ae867c0aeedcd990caa520c418), [`04a2433`](https://github.com/mastra-ai/mastra/commit/04a2433d8e533010e23c3af84421d52bd0b3a908), [`85cfc88`](https://github.com/mastra-ai/mastra/commit/85cfc88fc5f196ef97cd2334441cd30cac99bce1), [`f2073f6`](https://github.com/mastra-ai/mastra/commit/f2073f6f2fff59ffca7eeac67579093454a0e761), [`46bb6b2`](https://github.com/mastra-ai/mastra/commit/46bb6b29dd83cabb09cf720dd8a3655860bf5858), [`2bf5b78`](https://github.com/mastra-ai/mastra/commit/2bf5b78761af6606b42ae2e085722eb50cdbc839), [`dc28dbd`](https://github.com/mastra-ai/mastra/commit/dc28dbd89f7afa455a1985c7909adf42ddd6bd48), [`25b8b60`](https://github.com/mastra-ai/mastra/commit/25b8b6074cbb5f0c744e4edb4ce0c5ee1f3771d6), [`41bf075`](https://github.com/mastra-ai/mastra/commit/41bf0759e486ff7eb078ff9d83d532e086a16039), [`73e6b7c`](https://github.com/mastra-ai/mastra/commit/73e6b7c18ee19fbb31c6f9bad4ce23c16212876b), [`68fa51c`](https://github.com/mastra-ai/mastra/commit/68fa51cf57ee7a3b0914d5381870b60e81f0647e), [`faf79ea`](https://github.com/mastra-ai/mastra/commit/faf79ea0d1aa7b2265b070f5323339fa275ebb49), [`b801545`](https://github.com/mastra-ai/mastra/commit/b80154540bf557de296bcb6f068b5117b5d84ef9), [`a1793d7`](https://github.com/mastra-ai/mastra/commit/a1793d7d077ed450125628ede812897ecbf08c4c), [`3645c3d`](https://github.com/mastra-ai/mastra/commit/3645c3d67e0c1f40005035911103deba381d246a), [`a9c8af5`](https://github.com/mastra-ai/mastra/commit/a9c8af5b6b2449e4127ab30b662e79ac025cc4f0), [`028dc61`](https://github.com/mastra-ai/mastra/commit/028dc61f4802fad472603df1538c4ca126f8680f), [`f83023e`](https://github.com/mastra-ai/mastra/commit/f83023e66dc6cf50ffd3fe4007bb8945ec9b2826), [`e5688d2`](https://github.com/mastra-ai/mastra/commit/e5688d2945aff1e867eb8b9fc5f25393d6579216), [`1211fcf`](https://github.com/mastra-ai/mastra/commit/1211fcf499acbda22ca8d399ae820789c69609f2), [`a1c0020`](https://github.com/mastra-ai/mastra/commit/a1c002066736e54a4b07c03968b0df19cf1afb03), [`c0540d2`](https://github.com/mastra-ai/mastra/commit/c0540d2dfccec3470eed3cab539221557abd1fc5), [`297e55e`](https://github.com/mastra-ai/mastra/commit/297e55ea3d0eef280c3776bec401584ce3c2bff2), [`e995603`](https://github.com/mastra-ai/mastra/commit/e995603f64d4f03d234e7f53cc3ab03d9dfea502), [`2f0c604`](https://github.com/mastra-ai/mastra/commit/2f0c604b802068a063689fec4d0db91daa80d7c9), [`85636a2`](https://github.com/mastra-ai/mastra/commit/85636a2341aca229feb83c72b730a0d50f2f1753), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`2ef4283`](https://github.com/mastra-ai/mastra/commit/2ef428340d1eda6c6c8cfba4b90a43b88739f098), [`d45b854`](https://github.com/mastra-ai/mastra/commit/d45b854640e9b3d7fe7434061be988359ac2f470), [`b801545`](https://github.com/mastra-ai/mastra/commit/b80154540bf557de296bcb6f068b5117b5d84ef9), [`a7404f9`](https://github.com/mastra-ai/mastra/commit/a7404f965b811a0eef35d41a5e69c91187eb0cf6), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`ef231f2`](https://github.com/mastra-ai/mastra/commit/ef231f27f1d1507f1d3cd6717aa1489263b2e10b), [`4324cd3`](https://github.com/mastra-ai/mastra/commit/4324cd38ee744eb46b85ce0a9d3f2e4a0657ca87), [`4324cd3`](https://github.com/mastra-ai/mastra/commit/4324cd38ee744eb46b85ce0a9d3f2e4a0657ca87), [`5068168`](https://github.com/mastra-ai/mastra/commit/50681683948fd55928d029a63f0de7e56976e1f4), [`956901a`](https://github.com/mastra-ai/mastra/commit/956901a36b84a85f3985d9e5956494749b7ea72c), [`92004fd`](https://github.com/mastra-ai/mastra/commit/92004fd001edd2a0647f2531e0daf76a5825fc00), [`b389368`](https://github.com/mastra-ai/mastra/commit/b389368b0574a6a575a5835a11fc41437b78b842), [`38643be`](https://github.com/mastra-ai/mastra/commit/38643beb41ab0d1f67b8754f057781022448a618), [`6c9ad80`](https://github.com/mastra-ai/mastra/commit/6c9ad808c8503e812a72a48827ce425b9e78970f), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`eda5b00`](https://github.com/mastra-ai/mastra/commit/eda5b0081bdc49cc17ac8fc1267fccabb5e7a33f), [`4324cd3`](https://github.com/mastra-ai/mastra/commit/4324cd38ee744eb46b85ce0a9d3f2e4a0657ca87), [`838fd4b`](https://github.com/mastra-ai/mastra/commit/838fd4b1526c5385424d8e147d3d1d37137f6a13), [`f9659a2`](https://github.com/mastra-ai/mastra/commit/f9659a2b6612cbecadac9533af64bae6267272b8), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`85636a2`](https://github.com/mastra-ai/mastra/commit/85636a2341aca229feb83c72b730a0d50f2f1753), [`835e2cd`](https://github.com/mastra-ai/mastra/commit/835e2cdba8dbef6848f18bb73bbb8aa9dad6dddf), [`65b62c0`](https://github.com/mastra-ai/mastra/commit/65b62c04c28267ab81f7d6b92ed29ce0ef46671b), [`71f003a`](https://github.com/mastra-ai/mastra/commit/71f003afd305a6e81b1649e6e857a6b72486089f), [`0fca057`](https://github.com/mastra-ai/mastra/commit/0fca05756ac8409494d54c70106db2ef7dfc81fc), [`40fe078`](https://github.com/mastra-ai/mastra/commit/40fe078b30e4df383d65c9e0887236f900059d2f), [`57c3117`](https://github.com/mastra-ai/mastra/commit/57c3117dd4d0dd0ad0835edb1bf410b6ec76fba0), [`9db8229`](https://github.com/mastra-ai/mastra/commit/9db8229bc7c30133fb1c085f710f1fbf94e5d335), [`7a96951`](https://github.com/mastra-ai/mastra/commit/7a96951771a6aab850ceafefc73afe684ef24b21), [`3278e85`](https://github.com/mastra-ai/mastra/commit/3278e857ba50b6f29c53bf80069d15b2d3accd60), [`6c9ad80`](https://github.com/mastra-ai/mastra/commit/6c9ad808c8503e812a72a48827ce425b9e78970f), [`a3f884c`](https://github.com/mastra-ai/mastra/commit/a3f884c6fa230f9c75049f7105df5f1429fa406e), [`e89310a`](https://github.com/mastra-ai/mastra/commit/e89310a8db29a663a85c6a31a8c376cc8f59c129), [`7c0cf99`](https://github.com/mastra-ai/mastra/commit/7c0cf997ab2306a176aa84fe6f611574721120c3), [`46bb6b2`](https://github.com/mastra-ai/mastra/commit/46bb6b29dd83cabb09cf720dd8a3655860bf5858), [`a3269cd`](https://github.com/mastra-ai/mastra/commit/a3269cd4b92683780591ca782be491834787b861), [`152679c`](https://github.com/mastra-ai/mastra/commit/152679c4b74de8be29e5d932f6c4b35e79397516), [`18afca3`](https://github.com/mastra-ai/mastra/commit/18afca34ba6ab013152da61b2017dc443c2aa08b), [`9acbfa0`](https://github.com/mastra-ai/mastra/commit/9acbfa05394be0d21bb3dc6230f5be62c8e47de2), [`b6b3f49`](https://github.com/mastra-ai/mastra/commit/b6b3f49d35ce62b584d9753361a7db7c15045801), [`a2d52e1`](https://github.com/mastra-ai/mastra/commit/a2d52e1d6a1542e3eb994853145ffd113fd02c2f), [`3a7e3d0`](https://github.com/mastra-ai/mastra/commit/3a7e3d01211a7ad5696b242f033cd1a30b06912e), [`436ea9d`](https://github.com/mastra-ai/mastra/commit/436ea9d4fb8146250bb106fd0f0200ea1cfd47d5), [`aa95d15`](https://github.com/mastra-ai/mastra/commit/aa95d15913925da141d1b7f707c2fa4f45f7b317), [`a7a34bf`](https://github.com/mastra-ai/mastra/commit/a7a34bfcc2235daa6229d6783b3ad1a2eaa25c56), [`65b62c0`](https://github.com/mastra-ai/mastra/commit/65b62c04c28267ab81f7d6b92ed29ce0ef46671b), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`4416137`](https://github.com/mastra-ai/mastra/commit/4416137e6b9368c11fcb31edba3d1937cfe61a40), [`678e1c3`](https://github.com/mastra-ai/mastra/commit/678e1c36f9118165c3315c2fd739334d9138eff4), [`f2243ae`](https://github.com/mastra-ai/mastra/commit/f2243ae5e0d183fdbb8c8f3ff81fa86d32036a6c), [`70d59a9`](https://github.com/mastra-ai/mastra/commit/70d59a97fb2a5953c5853bf5f5fdfdc02d2337e7), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`005161a`](https://github.com/mastra-ai/mastra/commit/005161a90ac9a8d25a4f9b1edc95c139e5d295d9), [`14f9341`](https://github.com/mastra-ai/mastra/commit/14f934145150a2531abfc1c36d03909fd05b5c56), [`b329f0d`](https://github.com/mastra-ai/mastra/commit/b329f0d45ce719acdd8926263269de6c91e31305), [`539d0e6`](https://github.com/mastra-ai/mastra/commit/539d0e638c9eaa3b71d99df067061af4ddbb2045), [`46bb6b2`](https://github.com/mastra-ai/mastra/commit/46bb6b29dd83cabb09cf720dd8a3655860bf5858), [`956901a`](https://github.com/mastra-ai/mastra/commit/956901a36b84a85f3985d9e5956494749b7ea72c), [`c7283d7`](https://github.com/mastra-ai/mastra/commit/c7283d715d9c8a7f3d3afd904f402ea0d4d843c4), [`7cb014d`](https://github.com/mastra-ai/mastra/commit/7cb014d3bdd96739c4bd7ad968af34c6a88ced7e), [`fe99f41`](https://github.com/mastra-ai/mastra/commit/fe99f41ea293a172da840c89a782d13a7c7a7709), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`9f4ab32`](https://github.com/mastra-ai/mastra/commit/9f4ab3242bd686ff43c871fedeede1ed21260dbf), [`2558c00`](https://github.com/mastra-ai/mastra/commit/2558c00b338025de29f778ca72b6bd05e5726349), [`2f14b26`](https://github.com/mastra-ai/mastra/commit/2f14b267b06da7255ef7c131f1138993c39bd733), [`590d6ca`](https://github.com/mastra-ai/mastra/commit/590d6ca9fa6ccf8b55dcf2e98da080ee1a348f67), [`1511a1d`](https://github.com/mastra-ai/mastra/commit/1511a1d65d9e2ccc08b4d6746f8e8053fc48549e), [`1511a1d`](https://github.com/mastra-ai/mastra/commit/1511a1d65d9e2ccc08b4d6746f8e8053fc48549e), [`1511a1d`](https://github.com/mastra-ai/mastra/commit/1511a1d65d9e2ccc08b4d6746f8e8053fc48549e), [`f431c23`](https://github.com/mastra-ai/mastra/commit/f431c2321cf186f09565c42ddba33ee40cb96b6d), [`ea7ca75`](https://github.com/mastra-ai/mastra/commit/ea7ca755a470f026606949567da32e69969ef16c), [`a831a8b`](https://github.com/mastra-ai/mastra/commit/a831a8be6b92cf7a549e7b9d851f3c4295d4431b), [`436ea9d`](https://github.com/mastra-ai/mastra/commit/436ea9d4fb8146250bb106fd0f0200ea1cfd47d5), [`cfaeff3`](https://github.com/mastra-ai/mastra/commit/cfaeff3e03d6743682a8db0c1c30c2dab11b3171), [`180bdc5`](https://github.com/mastra-ai/mastra/commit/180bdc5398e253ffae7eaff6330409d7f5254f8b), [`45a1ab7`](https://github.com/mastra-ai/mastra/commit/45a1ab7f300637be9d5b953d82b58f77b64c1b56), [`70d59a9`](https://github.com/mastra-ai/mastra/commit/70d59a97fb2a5953c5853bf5f5fdfdc02d2337e7), [`33a206d`](https://github.com/mastra-ai/mastra/commit/33a206d7d0a52d17ebab8db5224c5091c086c86d), [`38643be`](https://github.com/mastra-ai/mastra/commit/38643beb41ab0d1f67b8754f057781022448a618), [`7c34315`](https://github.com/mastra-ai/mastra/commit/7c343153b26755a4cdcdd7897d2b4bd2758c29d4)]:
  - @mastra/core@1.76.0
  - @mastra/memory@1.37.0
  - @mastra/pg@1.31.0
  - @mastra/observability@1.19.0
  - @mastra/libsql@1.26.0
  - @mastra/duckdb@1.14.0
  - @mastra/mcp@2.3.0

## 1.12.0-alpha.9

### Minor Changes

- Added a `--pack <id>` flag to headless mode (`mastracode -p ... --pack anthropic`). It resolves builtin pack ids and saved custom packs (`custom:<name>` or bare name), exits with the list of valid packs on unknown ids, and applies the pack like `/models` → Activate: mode models, subagent models, model route, and thread `activeModelPackId`. An explicit `--model` still wins over the pack for the active mode. ([#26691](https://github.com/mastra-ai/mastra/pull/26691))

  **Example**

  ```bash
  mastracode -p "summarize this repo" --pack anthropic
  mastracode -p "fix the tests" --pack Kimi --model openai/gpt-5.5
  ```

### Patch Changes

- Fixed per-agent-type subagent model selections (`subagentModelId_explore/plan/execute`) being stripped from session state by schema validation. Pack activation (`/models` → Activate or `--pack`) assigned subagent models, but the next session state update silently dropped them, so subagents fell back to their default models. ([#26691](https://github.com/mastra-ai/mastra/pull/26691))

- Updated dependencies [[`a65d0c7`](https://github.com/mastra-ai/mastra/commit/a65d0c788824081f36ccd95078a8d1214ff687c4), [`e89310a`](https://github.com/mastra-ai/mastra/commit/e89310a8db29a663a85c6a31a8c376cc8f59c129), [`590d6ca`](https://github.com/mastra-ai/mastra/commit/590d6ca9fa6ccf8b55dcf2e98da080ee1a348f67)]:
  - @mastra/core@1.76.0-alpha.9

## 1.12.0-alpha.8

### Patch Changes

- Updated dependencies [[`b48ddcc`](https://github.com/mastra-ai/mastra/commit/b48ddcc7768c76f02d1dd4ed0f21d417a8b21418), [`cf6446c`](https://github.com/mastra-ai/mastra/commit/cf6446cae036784bd6802e4bcca8f3cf34a9ca9f), [`46bb6b2`](https://github.com/mastra-ai/mastra/commit/46bb6b29dd83cabb09cf720dd8a3655860bf5858), [`25b8b60`](https://github.com/mastra-ai/mastra/commit/25b8b6074cbb5f0c744e4edb4ce0c5ee1f3771d6), [`faf79ea`](https://github.com/mastra-ai/mastra/commit/faf79ea0d1aa7b2265b070f5323339fa275ebb49), [`a1793d7`](https://github.com/mastra-ai/mastra/commit/a1793d7d077ed450125628ede812897ecbf08c4c), [`3645c3d`](https://github.com/mastra-ai/mastra/commit/3645c3d67e0c1f40005035911103deba381d246a), [`e5688d2`](https://github.com/mastra-ai/mastra/commit/e5688d2945aff1e867eb8b9fc5f25393d6579216), [`ef231f2`](https://github.com/mastra-ai/mastra/commit/ef231f27f1d1507f1d3cd6717aa1489263b2e10b), [`4324cd3`](https://github.com/mastra-ai/mastra/commit/4324cd38ee744eb46b85ce0a9d3f2e4a0657ca87), [`4324cd3`](https://github.com/mastra-ai/mastra/commit/4324cd38ee744eb46b85ce0a9d3f2e4a0657ca87), [`eda5b00`](https://github.com/mastra-ai/mastra/commit/eda5b0081bdc49cc17ac8fc1267fccabb5e7a33f), [`4324cd3`](https://github.com/mastra-ai/mastra/commit/4324cd38ee744eb46b85ce0a9d3f2e4a0657ca87), [`46bb6b2`](https://github.com/mastra-ai/mastra/commit/46bb6b29dd83cabb09cf720dd8a3655860bf5858), [`b6b3f49`](https://github.com/mastra-ai/mastra/commit/b6b3f49d35ce62b584d9753361a7db7c15045801), [`a2d52e1`](https://github.com/mastra-ai/mastra/commit/a2d52e1d6a1542e3eb994853145ffd113fd02c2f), [`aa95d15`](https://github.com/mastra-ai/mastra/commit/aa95d15913925da141d1b7f707c2fa4f45f7b317), [`4416137`](https://github.com/mastra-ai/mastra/commit/4416137e6b9368c11fcb31edba3d1937cfe61a40), [`46bb6b2`](https://github.com/mastra-ai/mastra/commit/46bb6b29dd83cabb09cf720dd8a3655860bf5858), [`180bdc5`](https://github.com/mastra-ai/mastra/commit/180bdc5398e253ffae7eaff6330409d7f5254f8b), [`45a1ab7`](https://github.com/mastra-ai/mastra/commit/45a1ab7f300637be9d5b953d82b58f77b64c1b56)]:
  - @mastra/core@1.76.0-alpha.8
  - @mastra/libsql@1.26.0-alpha.3
  - @mastra/pg@1.31.0-alpha.4

## 1.12.0-alpha.7

### Minor Changes

- Replaced the quiet mode settings with a single `previewLines` preference, since compact rendering is now the only Mastra Code display mode. ([#26576](https://github.com/mastra-ai/mastra/pull/26576))

  `GlobalSettings` no longer has `preferences.quietMode`, `preferences.quietModeMaxToolPreviewLines` or `onboarding.quietModePreferenceSelected`. It adds `preferences.previewLines` (0–8, default 2). When settings load and `previewLines` isn't set yet, it is filled in from `quietModeMaxToolPreviewLines` and saved. The legacy keys stay in the file unchanged.

  ```ts
  // Before
  const lines = settings.preferences.quietModeMaxToolPreviewLines;

  // After
  const lines = settings.preferences.previewLines;
  ```

### Patch Changes

- Updated dependencies [[`20f7f87`](https://github.com/mastra-ai/mastra/commit/20f7f878953cb0965962d1e83a463be5e4ba2c26), [`d0db35e`](https://github.com/mastra-ai/mastra/commit/d0db35e00be93f1339525188c102f73dea5867d8), [`578d2c4`](https://github.com/mastra-ai/mastra/commit/578d2c41fc83b13efd88165ff0105904434a6db4), [`34844fc`](https://github.com/mastra-ai/mastra/commit/34844fcc7aeff1ae867c0aeedcd990caa520c418), [`2bf5b78`](https://github.com/mastra-ai/mastra/commit/2bf5b78761af6606b42ae2e085722eb50cdbc839), [`41bf075`](https://github.com/mastra-ai/mastra/commit/41bf0759e486ff7eb078ff9d83d532e086a16039), [`73e6b7c`](https://github.com/mastra-ai/mastra/commit/73e6b7c18ee19fbb31c6f9bad4ce23c16212876b), [`85636a2`](https://github.com/mastra-ai/mastra/commit/85636a2341aca229feb83c72b730a0d50f2f1753), [`85636a2`](https://github.com/mastra-ai/mastra/commit/85636a2341aca229feb83c72b730a0d50f2f1753)]:
  - @mastra/core@1.76.0-alpha.7
  - @mastra/observability@1.19.0-alpha.4
  - @mastra/mcp@2.3.0-alpha.1

## 1.12.0-alpha.6

### Patch Changes

- Fixed the update check treating a prerelease, such as `1.2.0-alpha.1`, as already up to date when its stable release (`1.2.0`) is out. `/update`, `mastracode update`, and the startup update notice now offer the stable release. ([#26455](https://github.com/mastra-ai/mastra/pull/26455))

- Update results now include their parts as separate fields (`via`, `command`, `details`, `installDir`, `runningVersion`, `ranWith`, `managedBy`) alongside `message`, so callers can lay them out. ([#26455](https://github.com/mastra-ai/mastra/pull/26455))

  Added `planUpdate(pm, version)`, which decides how an update will run without changing anything: an install (with the tool and command), or no install with the result to show instead, for example when Homebrew owns the install. `performUpdate` follows the same plan, and accepts one you already showed the user:

  ```ts
  const plan = await planUpdate(pm, latestVersion);
  if (plan.willInstall) {
    console.log(`Installing with ${plan.via}: ${plan.command}`);
    const outcome = await performUpdate(pm, latestVersion, plan);
  }
  ```

- Updated dependencies [[`b196f30`](https://github.com/mastra-ai/mastra/commit/b196f30602005325e95bde29a9b7676aeea14c42), [`cca0f8a`](https://github.com/mastra-ai/mastra/commit/cca0f8a543eca15c24be21c8ee43dc46fb7aefae), [`06e428d`](https://github.com/mastra-ai/mastra/commit/06e428d80ccbc54bb74eb6bd6f01a7fd4eddc45f), [`b875985`](https://github.com/mastra-ai/mastra/commit/b87598584f0f2b008242ed1f458b7f72ba6d42d1), [`85cfc88`](https://github.com/mastra-ai/mastra/commit/85cfc88fc5f196ef97cd2334441cd30cac99bce1), [`f2073f6`](https://github.com/mastra-ai/mastra/commit/f2073f6f2fff59ffca7eeac67579093454a0e761), [`a1c0020`](https://github.com/mastra-ai/mastra/commit/a1c002066736e54a4b07c03968b0df19cf1afb03), [`5068168`](https://github.com/mastra-ai/mastra/commit/50681683948fd55928d029a63f0de7e56976e1f4), [`6c9ad80`](https://github.com/mastra-ai/mastra/commit/6c9ad808c8503e812a72a48827ce425b9e78970f), [`6c9ad80`](https://github.com/mastra-ai/mastra/commit/6c9ad808c8503e812a72a48827ce425b9e78970f), [`a3269cd`](https://github.com/mastra-ai/mastra/commit/a3269cd4b92683780591ca782be491834787b861), [`152679c`](https://github.com/mastra-ai/mastra/commit/152679c4b74de8be29e5d932f6c4b35e79397516), [`7cb014d`](https://github.com/mastra-ai/mastra/commit/7cb014d3bdd96739c4bd7ad968af34c6a88ced7e), [`9f4ab32`](https://github.com/mastra-ai/mastra/commit/9f4ab3242bd686ff43c871fedeede1ed21260dbf), [`a831a8b`](https://github.com/mastra-ai/mastra/commit/a831a8be6b92cf7a549e7b9d851f3c4295d4431b)]:
  - @mastra/core@1.76.0-alpha.6
  - @mastra/observability@1.19.0-alpha.3
  - @mastra/mcp@2.3.0-alpha.1

## 1.12.0-alpha.5

### Patch Changes

- Updated dependencies [[`908f923`](https://github.com/mastra-ai/mastra/commit/908f92340e14f776d7a69edab244d0ae3cefe057), [`2f0c604`](https://github.com/mastra-ai/mastra/commit/2f0c604b802068a063689fec4d0db91daa80d7c9), [`678e1c3`](https://github.com/mastra-ai/mastra/commit/678e1c36f9118165c3315c2fd739334d9138eff4), [`7c34315`](https://github.com/mastra-ai/mastra/commit/7c343153b26755a4cdcdd7897d2b4bd2758c29d4)]:
  - @mastra/core@1.76.0-alpha.5

## 1.12.0-alpha.4

### Minor Changes

- Rearchitected an experimental memory feature. ([#26024](https://github.com/mastra-ai/mastra/pull/26024))

### Patch Changes

- Fixed DeepSeek models ignoring the thinking level. Max on DeepSeek V4 Pro now asks for maximum effort, and Low asks for low effort. Off still leaves DeepSeek on its own default. ([#26407](https://github.com/mastra-ai/mastra/pull/26407))

- Improved Mastra Code observational memory so automatic Observer and Reflector roles follow the active main model provider while explicit role choices stay pinned. ([#24508](https://github.com/mastra-ai/mastra/pull/24508))

- The built-in OpenAI Observational Memory pack now uses `openai/gpt-6-luna` instead of `openai/gpt-5.4-mini`. ([#24508](https://github.com/mastra-ai/mastra/pull/24508))

- Factory observational memory now supports automatic model selection per role. `PUT /web/config/om/:role/model` accepts `modelId: 'auto'` to clear that role back to automatic selection, and any other value to pin it. Previously `'auto'` was stored as if it were a model name, which pinned the role to a model that does not exist; automatic roles are now stored as `null` and follow the active main model on every run. The request body is unchanged, so existing callers keep working. ([#24508](https://github.com/mastra-ai/mastra/pull/24508))

  Connecting a model provider or signing in over ACP no longer writes observer or reflector selections, and the unused `POST /web/config/om/provider-defaults` route was removed. Stored settings are applied per run instead of being copied into session state. Settings responses now report each role's intent, its effective model, and whether that model's provider is currently available; `mastra/` models count as available when the Mastra gateway key is configured. If Factory cannot load the saved settings for a run, memory falls back to Auto models and default thresholds, and the thread shows an error explaining that saved choices were not applied.

  `MastraCodeConfig.inputProcessors` also accepts a function of `{ requestContext }`, so hosts can choose input processors per request:

  ```ts
  await createMastraCodeAgentController({
    inputProcessors: ({ requestContext }) => (requestContext.get('channel') ? [channelProcessor] : []),
  });
  ```

  The server now prevents request payloads from overriding Factory's internal memory-settings context.

- Updated dependencies [[`65b62c0`](https://github.com/mastra-ai/mastra/commit/65b62c04c28267ab81f7d6b92ed29ce0ef46671b), [`8f51bae`](https://github.com/mastra-ai/mastra/commit/8f51bae55307c62f18d2b69da27270ebdf1f728f), [`68fa51c`](https://github.com/mastra-ai/mastra/commit/68fa51cf57ee7a3b0914d5381870b60e81f0647e), [`297e55e`](https://github.com/mastra-ai/mastra/commit/297e55ea3d0eef280c3776bec401584ce3c2bff2), [`38643be`](https://github.com/mastra-ai/mastra/commit/38643beb41ab0d1f67b8754f057781022448a618), [`65b62c0`](https://github.com/mastra-ai/mastra/commit/65b62c04c28267ab81f7d6b92ed29ce0ef46671b), [`57c3117`](https://github.com/mastra-ai/mastra/commit/57c3117dd4d0dd0ad0835edb1bf410b6ec76fba0), [`7a96951`](https://github.com/mastra-ai/mastra/commit/7a96951771a6aab850ceafefc73afe684ef24b21), [`436ea9d`](https://github.com/mastra-ai/mastra/commit/436ea9d4fb8146250bb106fd0f0200ea1cfd47d5), [`65b62c0`](https://github.com/mastra-ai/mastra/commit/65b62c04c28267ab81f7d6b92ed29ce0ef46671b), [`14f9341`](https://github.com/mastra-ai/mastra/commit/14f934145150a2531abfc1c36d03909fd05b5c56), [`2558c00`](https://github.com/mastra-ai/mastra/commit/2558c00b338025de29f778ca72b6bd05e5726349), [`436ea9d`](https://github.com/mastra-ai/mastra/commit/436ea9d4fb8146250bb106fd0f0200ea1cfd47d5), [`38643be`](https://github.com/mastra-ai/mastra/commit/38643beb41ab0d1f67b8754f057781022448a618)]:
  - @mastra/core@1.76.0-alpha.4
  - @mastra/observability@1.19.0-alpha.2
  - @mastra/memory@1.37.0-alpha.2
  - @mastra/libsql@1.26.0-alpha.2
  - @mastra/pg@1.31.0-alpha.3
  - @mastra/mcp@2.2.1-alpha.0

## 1.12.0-alpha.3

### Patch Changes

- Updated dependencies [[`9a511a4`](https://github.com/mastra-ai/mastra/commit/9a511a4ff5ac8349f4d4b64b0f432576fa3c8656), [`ed0e355`](https://github.com/mastra-ai/mastra/commit/ed0e355205da51bac4d11b7a9553c95ef1f505f4), [`b93ce2e`](https://github.com/mastra-ai/mastra/commit/b93ce2ee034c6a0be511b717e1e043e875dca677), [`21eaa20`](https://github.com/mastra-ai/mastra/commit/21eaa208834ae36721324700023f88cec7cf5c01), [`4580309`](https://github.com/mastra-ai/mastra/commit/45803095e2aed7bf58d878eb206a767b9b0e2489), [`dc28dbd`](https://github.com/mastra-ai/mastra/commit/dc28dbd89f7afa455a1985c7909adf42ddd6bd48), [`f83023e`](https://github.com/mastra-ai/mastra/commit/f83023e66dc6cf50ffd3fe4007bb8945ec9b2826), [`a3f884c`](https://github.com/mastra-ai/mastra/commit/a3f884c6fa230f9c75049f7105df5f1429fa406e), [`a7a34bf`](https://github.com/mastra-ai/mastra/commit/a7a34bfcc2235daa6229d6783b3ad1a2eaa25c56), [`70d59a9`](https://github.com/mastra-ai/mastra/commit/70d59a97fb2a5953c5853bf5f5fdfdc02d2337e7), [`f431c23`](https://github.com/mastra-ai/mastra/commit/f431c2321cf186f09565c42ddba33ee40cb96b6d), [`70d59a9`](https://github.com/mastra-ai/mastra/commit/70d59a97fb2a5953c5853bf5f5fdfdc02d2337e7), [`33a206d`](https://github.com/mastra-ai/mastra/commit/33a206d7d0a52d17ebab8db5224c5091c086c86d)]:
  - @mastra/core@1.76.0-alpha.3
  - @mastra/memory@1.37.0-alpha.1
  - @mastra/observability@1.19.0-alpha.1
  - @mastra/mcp@2.2.1-alpha.0

## 1.12.0-alpha.2

### Patch Changes

- Updated dependencies [[`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`1211fcf`](https://github.com/mastra-ai/mastra/commit/1211fcf499acbda22ca8d399ae820789c69609f2), [`e995603`](https://github.com/mastra-ai/mastra/commit/e995603f64d4f03d234e7f53cc3ab03d9dfea502), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`9acbfa0`](https://github.com/mastra-ai/mastra/commit/9acbfa05394be0d21bb3dc6230f5be62c8e47de2), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`eec3388`](https://github.com/mastra-ai/mastra/commit/eec3388f29248ecb71724e8ca0a9afef7a522629), [`cfaeff3`](https://github.com/mastra-ai/mastra/commit/cfaeff3e03d6743682a8db0c1c30c2dab11b3171)]:
  - @mastra/core@1.76.0-alpha.2
  - @mastra/libsql@1.25.2-alpha.1
  - @mastra/pg@1.31.0-alpha.2

## 1.12.0-alpha.1

### Minor Changes

- Added `runThinkingLevel` to `@mastra/code-sdk/thinking`. It returns the thinking level a request actually sends for a model, using the reasoning options models.dev publishes. `getAvailableThinkingLevelsForModel` takes the same options and lists only levels that send a different request. ([#26229](https://github.com/mastra-ai/mastra/pull/26229))

  ```ts
  import { getModelReasoningOptions } from '@mastra/core/llm';
  import { getAvailableThinkingLevelsForModel, runThinkingLevel } from '@mastra/code-sdk/thinking';

  const options = getModelReasoningOptions('openai/gpt-5');
  runThinkingLevel('openai/gpt-5', 'max', options); // 'high'
  getAvailableThinkingLevelsForModel('openai/gpt-5', options); // ['off', 'low', 'medium', 'high']
  ```

  Fixed GPT-5 requests at Extra high or Max thinking. They sent `xhigh`, an effort models.dev does not list for the model, and now send `high`.

  Models that models.dev lists without reasoning controls, such as GPT-4o, now run every level as `off`, so GPT-4o requests no longer carry a reasoning effort. Claude and Gemini models keep the levels their thinking settings send.

### Patch Changes

- Fixed `agent_signal_send` reporting a signal as failed when it had been saved to the target agent's inbox. For signals that don't require a reply, when direct delivery fails but the notification is still pending, the tool now says the signal was queued, includes the delivery error, and suggests retrying with the same messageId. Signals sent with `expectsReply: true` still return an error in this case, because the reply obligation was not established. ([#26292](https://github.com/mastra-ai/mastra/pull/26292))

- Fixed restarted Mastra Code sessions staying unreachable to other agents for up to about 13 seconds. A session that was shutting down kept its threads claimed until it fully exited, and the restarted session waited up to 5 seconds between attempts to claim them. Shutdown in the TUI, headless mode and ACP now releases thread claims first, so a restarted session is reachable again within about a second. Retries are also capped at 1 second. ([#26292](https://github.com/mastra-ai/mastra/pull/26292))

  Embedders that shut down a `createMastraCode()` result themselves can call the new `releaseThreadClaims()` at the start of their teardown:

  ```ts
  const mastraCode = await createMastraCode(config);

  // On shutdown, before stopping workers and closing storage:
  mastraCode.releaseThreadClaims();
  ```

- Removed the "Starting on <account>" notice that was emitted at the start of each turn when using subscription accounts. Preferred-account routing is unchanged. ([#25937](https://github.com/mastra-ai/mastra/pull/25937))

- Updated dependencies [[`4b8f1d7`](https://github.com/mastra-ai/mastra/commit/4b8f1d74adb2b1742fd10ebb1d24e863329075aa), [`d4e6c7f`](https://github.com/mastra-ai/mastra/commit/d4e6c7fffdef836fc44276509596e78d7d785729), [`b801545`](https://github.com/mastra-ai/mastra/commit/b80154540bf557de296bcb6f068b5117b5d84ef9), [`ddb53f2`](https://github.com/mastra-ai/mastra/commit/ddb53f26142ccf6177dec5392b6dc867ce177d15), [`42a3c74`](https://github.com/mastra-ai/mastra/commit/42a3c748085fee95d4e38e42a4ccbce891ce3e3f), [`b801545`](https://github.com/mastra-ai/mastra/commit/b80154540bf557de296bcb6f068b5117b5d84ef9), [`a9c8af5`](https://github.com/mastra-ai/mastra/commit/a9c8af5b6b2449e4127ab30b662e79ac025cc4f0), [`028dc61`](https://github.com/mastra-ai/mastra/commit/028dc61f4802fad472603df1538c4ca126f8680f), [`2ef4283`](https://github.com/mastra-ai/mastra/commit/2ef428340d1eda6c6c8cfba4b90a43b88739f098), [`d45b854`](https://github.com/mastra-ai/mastra/commit/d45b854640e9b3d7fe7434061be988359ac2f470), [`b801545`](https://github.com/mastra-ai/mastra/commit/b80154540bf557de296bcb6f068b5117b5d84ef9), [`92004fd`](https://github.com/mastra-ai/mastra/commit/92004fd001edd2a0647f2531e0daf76a5825fc00), [`b389368`](https://github.com/mastra-ai/mastra/commit/b389368b0574a6a575a5835a11fc41437b78b842), [`f9659a2`](https://github.com/mastra-ai/mastra/commit/f9659a2b6612cbecadac9533af64bae6267272b8), [`835e2cd`](https://github.com/mastra-ai/mastra/commit/835e2cdba8dbef6848f18bb73bbb8aa9dad6dddf), [`0fca057`](https://github.com/mastra-ai/mastra/commit/0fca05756ac8409494d54c70106db2ef7dfc81fc), [`40fe078`](https://github.com/mastra-ai/mastra/commit/40fe078b30e4df383d65c9e0887236f900059d2f), [`9db8229`](https://github.com/mastra-ai/mastra/commit/9db8229bc7c30133fb1c085f710f1fbf94e5d335), [`3278e85`](https://github.com/mastra-ai/mastra/commit/3278e857ba50b6f29c53bf80069d15b2d3accd60), [`3a7e3d0`](https://github.com/mastra-ai/mastra/commit/3a7e3d01211a7ad5696b242f033cd1a30b06912e), [`005161a`](https://github.com/mastra-ai/mastra/commit/005161a90ac9a8d25a4f9b1edc95c139e5d295d9), [`c7283d7`](https://github.com/mastra-ai/mastra/commit/c7283d715d9c8a7f3d3afd904f402ea0d4d843c4), [`2f14b26`](https://github.com/mastra-ai/mastra/commit/2f14b267b06da7255ef7c131f1138993c39bd733), [`ea7ca75`](https://github.com/mastra-ai/mastra/commit/ea7ca755a470f026606949567da32e69969ef16c)]:
  - @mastra/core@1.76.0-alpha.1
  - @mastra/memory@1.37.0-alpha.0
  - @mastra/pg@1.31.0-alpha.1
  - @mastra/libsql@1.25.2-alpha.0
  - @mastra/mcp@2.2.1-alpha.0

## 1.11.1-alpha.0

### Patch Changes

- Factory deployments with sign-in enabled can now use Amazon Bedrock. Opt in on the server, then provide AWS credentials and `AWS_REGION` there. Every signed-in account can then pick Bedrock models without saving a per-account API key. ([#26249](https://github.com/mastra-ai/mastra/pull/26249))

  ```ts
  new MastraFactory({
    // ...
    deploymentModelProviders: ['amazon-bedrock'],
  });
  ```

  The web deployment reads the same list from `FACTORY_DEPLOYMENT_MODEL_PROVIDERS=amazon-bedrock`.

  Without the opt-in, Bedrock stays hidden from signed-in accounts and runs fail with a `ProviderAuthRequiredError`. Before this change, a run could silently fall back to whatever AWS credentials the server had.

- Updated dependencies [[`2233844`](https://github.com/mastra-ai/mastra/commit/223384452984718e16fc660d29f0d5d93a1ebaf2), [`6df693a`](https://github.com/mastra-ai/mastra/commit/6df693aa926482422ef447d8db058adef36a594b), [`a8f39b6`](https://github.com/mastra-ai/mastra/commit/a8f39b629d8bcd6659b61bf71bd5a5dd2f38ed12), [`04a2433`](https://github.com/mastra-ai/mastra/commit/04a2433d8e533010e23c3af84421d52bd0b3a908), [`c0540d2`](https://github.com/mastra-ai/mastra/commit/c0540d2dfccec3470eed3cab539221557abd1fc5), [`a7404f9`](https://github.com/mastra-ai/mastra/commit/a7404f965b811a0eef35d41a5e69c91187eb0cf6), [`956901a`](https://github.com/mastra-ai/mastra/commit/956901a36b84a85f3985d9e5956494749b7ea72c), [`838fd4b`](https://github.com/mastra-ai/mastra/commit/838fd4b1526c5385424d8e147d3d1d37137f6a13), [`71f003a`](https://github.com/mastra-ai/mastra/commit/71f003afd305a6e81b1649e6e857a6b72486089f), [`7c0cf99`](https://github.com/mastra-ai/mastra/commit/7c0cf997ab2306a176aa84fe6f611574721120c3), [`18afca3`](https://github.com/mastra-ai/mastra/commit/18afca34ba6ab013152da61b2017dc443c2aa08b), [`f2243ae`](https://github.com/mastra-ai/mastra/commit/f2243ae5e0d183fdbb8c8f3ff81fa86d32036a6c), [`b329f0d`](https://github.com/mastra-ai/mastra/commit/b329f0d45ce719acdd8926263269de6c91e31305), [`539d0e6`](https://github.com/mastra-ai/mastra/commit/539d0e638c9eaa3b71d99df067061af4ddbb2045), [`956901a`](https://github.com/mastra-ai/mastra/commit/956901a36b84a85f3985d9e5956494749b7ea72c), [`fe99f41`](https://github.com/mastra-ai/mastra/commit/fe99f41ea293a172da840c89a782d13a7c7a7709), [`1511a1d`](https://github.com/mastra-ai/mastra/commit/1511a1d65d9e2ccc08b4d6746f8e8053fc48549e), [`1511a1d`](https://github.com/mastra-ai/mastra/commit/1511a1d65d9e2ccc08b4d6746f8e8053fc48549e), [`1511a1d`](https://github.com/mastra-ai/mastra/commit/1511a1d65d9e2ccc08b4d6746f8e8053fc48549e)]:
  - @mastra/core@1.76.0-alpha.0
  - @mastra/observability@1.19.0-alpha.0
  - @mastra/duckdb@1.14.0-alpha.0
  - @mastra/pg@1.31.0-alpha.0
  - @mastra/mcp@2.2.0

## 1.11.0

### Minor Changes

- Made the controller runtime independent of Mastra Code model packs. Hosts can now provide a generic modelRoute for fallback models, account routing, and observational-memory models. Removed disableModelPacks and activeModelPackId from the controller runtime state. ([#25997](https://github.com/mastra-ai/mastra/pull/25997))

  **Before**

  ```ts
  const code = await createMastraCode({ disableModelPacks: true });
  await session.state.set({ activeModelPackId: 'anthropic' });
  ```

  **After**

  ```ts
  const code = await createMastraCode();
  await session.state.set({
    modelRoute: {
      entries: [
        { id: 'primary', label: 'Primary', modelId: 'openai/gpt-5.6' },
        { id: 'fallback', label: 'Fallback', modelId: 'anthropic/claude-fable-5' },
      ],
    },
  });
  ```

- Added a `createInitialThread` option to `createMastraCode()`. Set it to `false` to start without a thread; the first message creates one, so a session that's never used leaves no empty thread behind. The default is unchanged. ([#22561](https://github.com/mastra-ai/mastra/pull/22561))

  ```ts
  createMastraCode({ createInitialThread: false });
  ```

- Agents in different projects on the same machine can now find each other. With cross-agent communication on (`crossAgentSignals: true` or the `signals.experimentalCrossAgentSignals` setting), `agent_connections_list` lists Mastra Code instances in every project, and `agent_connect` and `agent_signal_send` reach them. Before, the list only showed instances in the same project. ([#25758](https://github.com/mastra-ai/mastra/pull/25758))

  ```ts
  import { createMastraCode } from '@mastra/code-sdk';

  const mastraCode = await createMastraCode({
    unixSocketPubSub: true,
    crossAgentSignals: true,
  });
  ```

  An instance whose resource ID (from `MASTRA_RESOURCE_ID` or `.mastracode/database.json`) can't be used as a directory name, for example one containing `/`, stays out of cross-project discovery and logs one warning at startup.

  Any local process running as the same user can discover and message advertised agents. Set `MASTRACODE_SIGNALS_SOCKET_ROOT` to an absolute path to keep an instance or a test away from the shared `/tmp/mc` directory.

  Also fixed signal sockets piling up under `/tmp/mc`. Every agent discovery request used to leave an open socket, and often a socket file, behind, so long-running instances could accumulate thousands. One-off discovery replies now close as soon as they're answered. Headless `mastracode --prompt` runs also close their signal sockets on exit instead of leaving the files behind.

- Editors that connect to Mastra Code over ACP (Agent Client Protocol), such as Zed and JetBrains IDEs, can now sign you in without leaving the editor. ([#25871](https://github.com/mastra-ai/mastra/pull/25871))

  - Sign in with a ChatGPT subscription, Kimi For Coding, or xAI in the browser, started from the editor.
  - Editors that support terminal sign-in also get Claude and GitHub Copilot sign-in, plus `mastracode-login` for any other provider or an API key. Each runs `mastracode login` in a terminal.
  - Starting a session with no configured provider returns an `auth_required` error, so editors show these sign-in options instead of a session with no usable model.
  - New sessions start on a model you can use. If the default model's provider isn't configured, the session switches to the default model of a provider you signed in to.

  ```ts
  const { authMethods } = await connection.initialize({
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: { auth: { terminal: true } },
  });
  // openai-codex, kimi-for-coding, xai, anthropic, github-copilot, mastracode-login

  await connection.authenticate({ methodId: 'openai-codex' });
  ```

### Patch Changes

- Fixed Unix socket path handling so a thread ID can no longer place a socket outside its resource directory, whether or not cross-project agent discovery is enabled. Thread IDs that would reuse the lease or discovery socket names are rejected as well. ([#25876](https://github.com/mastra-ai/mastra/pull/25876))

- Observational memory and thread-title calls on Anthropic no longer write their whole prompt to the 1-hour prompt cache. Each call sends different conversation content, so that cache entry was never read. They now cache only their shared instructions for 5 minutes, which the next observer call reads. The main agent still uses the 1-hour cache. ([#25739](https://github.com/mastra-ai/mastra/pull/25739))

- Fixed Mastra Code starting a second agent run on a thread that was already running in another project's Mastra Code process. Every local Mastra Code process shares one database, so any of them could pick up a notification meant for another project's thread, see that thread as idle, and run it with its own session and workspace. ([#25741](https://github.com/mastra-ai/mastra/pull/25741))

  Mastra Code processes now coordinate a thread's runs no matter which project they belong to, so a busy thread stays busy for every process. Each process delivers the due notifications of its own sessions' resources itself, and only one process delivers a resource's notifications at a time, so a notification is never run by a process that cannot own its thread.

- Improved ACP session shutdown by waiting up to two seconds for pending notification dispatch and stopping workers before closing session resources. ([#25875](https://github.com/mastra-ai/mastra/pull/25875))

- Fixed ACP model selection to apply the model and its compatible thinking level together. ([#26069](https://github.com/mastra-ai/mastra/pull/26069))

- Mastra Code now caches prompts for 1 hour instead of 5 minutes on direct Anthropic connections (API key or Claude subscription), and waits for 1 hour of idle time before activating buffered observations on those models. Claude through other providers, such as Amazon Bedrock, keeps the 5-minute behavior. Coming back to a conversation after a break of up to an hour reuses the cached prompt instead of resending it in full. ([#25727](https://github.com/mastra-ai/mastra/pull/25727))

  **Cost tradeoff:** writing a 1-hour cache entry costs 2× the base input price, compared with 1.25× for a 5-minute entry. Cache reads cost the same. Sessions that pause for between 5 minutes and an hour can come out cheaper because they read the cache instead of rewriting it. Sessions that never pause that long pay more for every cache write.

  The 1-hour cache also applies to Anthropic models used for memory observation, reflection, and thread titles, since they go through the same model setup.

- Bumped the ajv pin in the ACP validator script to 8.20.0. No runtime changes. ([#25816](https://github.com/mastra-ai/mastra/pull/25816))

- Bumped probe-image-size to ^7.4.0 in @mastra/memory to pick up the fix for a quadratic-time denial of service in its SVG parser (GHSA-gjj5-9665-rwrc). Bumped the smol-toml pin in @mastra/code-sdk from 1.8.0 to 1.9.0 for a parser security fix. No API changes. ([#25966](https://github.com/mastra-ai/mastra/pull/25966))

- Updated dependencies [[`b54fda3`](https://github.com/mastra-ai/mastra/commit/b54fda3f30330d65e52bf34802f0aa4035e30ef8), [`b0d2c38`](https://github.com/mastra-ai/mastra/commit/b0d2c387ec339229d878fdd9bbf6b6f87ec308b8), [`4bae2c7`](https://github.com/mastra-ai/mastra/commit/4bae2c7d83a1194be5ecbe624469ec85053e4b81), [`97644a7`](https://github.com/mastra-ai/mastra/commit/97644a78cafe8276026509c56a70108075e950b7), [`9168424`](https://github.com/mastra-ai/mastra/commit/9168424453b5c0d793e0ddaa8066dceec60f619a), [`32fbecb`](https://github.com/mastra-ai/mastra/commit/32fbecb00efffa19c1b36b18e3411ff9ed14fac0), [`06e3dcf`](https://github.com/mastra-ai/mastra/commit/06e3dcf59aa937d8d5ab4de61b87465dfe38a62d), [`56eb894`](https://github.com/mastra-ai/mastra/commit/56eb894700575480c0e5d14a1ed7b633008610f2), [`79b3c78`](https://github.com/mastra-ai/mastra/commit/79b3c7875c511a718526020e3442bca433787199), [`8a5278a`](https://github.com/mastra-ai/mastra/commit/8a5278a8ab3fc6d4ae81073c7cef100954b4f0ef), [`d253891`](https://github.com/mastra-ai/mastra/commit/d2538914d2305d905bc9ed1dc7928b7f7ecc931a), [`f0305e9`](https://github.com/mastra-ai/mastra/commit/f0305e95779240bbd54fe44f5cca518478eeef6d), [`7a50f76`](https://github.com/mastra-ai/mastra/commit/7a50f76900eb1488f755090651deae87b57cbab1), [`9c5fd7d`](https://github.com/mastra-ai/mastra/commit/9c5fd7dd5468d4b029d1015a711b328010a71484), [`6cb981b`](https://github.com/mastra-ai/mastra/commit/6cb981bc62994e4c775864204617af70a7db3c4a), [`b1a5896`](https://github.com/mastra-ai/mastra/commit/b1a5896196764500614cd435c48c6364a00e8726), [`4cf860a`](https://github.com/mastra-ai/mastra/commit/4cf860a5a550a21fabce43010e6f1c95710e155c), [`e554c6d`](https://github.com/mastra-ai/mastra/commit/e554c6d7ff40805950f37a230ede4e2db82fc426), [`e5f53fe`](https://github.com/mastra-ai/mastra/commit/e5f53fe5965b22b274435bde05fd75f0b851e1e5), [`9c5fd7d`](https://github.com/mastra-ai/mastra/commit/9c5fd7dd5468d4b029d1015a711b328010a71484), [`1f7133c`](https://github.com/mastra-ai/mastra/commit/1f7133cffb88a67c5e1109a67342fc72ae861e6a), [`dac82ea`](https://github.com/mastra-ai/mastra/commit/dac82eaa324b66acad38d468799fa4e66594107f), [`3b03b05`](https://github.com/mastra-ai/mastra/commit/3b03b054281496e07201284f686b20b4dc2c51b1), [`06496a9`](https://github.com/mastra-ai/mastra/commit/06496a961baaa86178efe24be052107ea019d649), [`616ef0f`](https://github.com/mastra-ai/mastra/commit/616ef0fa482a7724f5e93609ab4f3960e3784a17), [`b1a5896`](https://github.com/mastra-ai/mastra/commit/b1a5896196764500614cd435c48c6364a00e8726), [`bcc2ceb`](https://github.com/mastra-ai/mastra/commit/bcc2ceb951d5259d09cde558dd6b86015b096d5c), [`9d4f647`](https://github.com/mastra-ai/mastra/commit/9d4f647c52ac5701f04ff320399d01b4cc2f0942), [`cdf0d0b`](https://github.com/mastra-ai/mastra/commit/cdf0d0bcad55398a2022bbf10fe921ca801d09ac), [`7736c40`](https://github.com/mastra-ai/mastra/commit/7736c40dedd54ce840f834f7de862e64895cd3a8), [`ce51958`](https://github.com/mastra-ai/mastra/commit/ce5195800c77c90141ee38684b4b163006dd56ff), [`b9c0fe5`](https://github.com/mastra-ai/mastra/commit/b9c0fe5e4cc4bc1758a7569837ae9e76a6e35839), [`bf982e9`](https://github.com/mastra-ai/mastra/commit/bf982e91512d5fb864984b44e649f104b7a9d7a4), [`da4eac9`](https://github.com/mastra-ai/mastra/commit/da4eac96c1856b81dd132183bccb3247de1d427f), [`832f57d`](https://github.com/mastra-ai/mastra/commit/832f57da36a03e5a90bf3ccc90e9df26ecf7d59d), [`97644a7`](https://github.com/mastra-ai/mastra/commit/97644a78cafe8276026509c56a70108075e950b7), [`ed8b01a`](https://github.com/mastra-ai/mastra/commit/ed8b01a81ebf018779571de5d9af63cdc61c5693), [`a3d23f9`](https://github.com/mastra-ai/mastra/commit/a3d23f9c2ea1283001b06dffd5015f798bf75d9d), [`757b1e4`](https://github.com/mastra-ai/mastra/commit/757b1e48e8645fd99551b0af9e8ce1b415f876ea), [`d2f2243`](https://github.com/mastra-ai/mastra/commit/d2f2243ed0d3190b685d0b1a9349ca00a95ce647), [`edf1ce6`](https://github.com/mastra-ai/mastra/commit/edf1ce69cc703f917cd2ee06488293a1f1d45597), [`7e63f04`](https://github.com/mastra-ai/mastra/commit/7e63f0486ea13841fc64395e3c03866afa476449), [`056427c`](https://github.com/mastra-ai/mastra/commit/056427cda3e9b7c064e55daaa688601807806840), [`824eb7f`](https://github.com/mastra-ai/mastra/commit/824eb7fef2eb3a52a63c59c2b879c7211294e5ae), [`648a4f3`](https://github.com/mastra-ai/mastra/commit/648a4f3ec442416816173e5fd64b97efd930df8d), [`539b958`](https://github.com/mastra-ai/mastra/commit/539b958da37c302f0b8bee5d9ce2b063c63ab09a), [`847a426`](https://github.com/mastra-ai/mastra/commit/847a426fc2158fdec7c939e576e8072c7998f2e3), [`01ac36b`](https://github.com/mastra-ai/mastra/commit/01ac36bf59295cf16d7a86c04f5776a4f1c98132), [`4c1bc9d`](https://github.com/mastra-ai/mastra/commit/4c1bc9d87fb5545b190e7e691331576781bffecf), [`f6fb6bc`](https://github.com/mastra-ai/mastra/commit/f6fb6bc2b0efadd6b744b6f73f07aa9800e5fc07), [`19a6380`](https://github.com/mastra-ai/mastra/commit/19a63803204ee9ebbbca77d9245801d6cd6f89b4), [`810b48d`](https://github.com/mastra-ai/mastra/commit/810b48dd77d992966a47ca5920e3c32267521b3a), [`7e63f04`](https://github.com/mastra-ai/mastra/commit/7e63f0486ea13841fc64395e3c03866afa476449), [`b0d2b33`](https://github.com/mastra-ai/mastra/commit/b0d2b336efd2a023a9f29218b442b386e42248f9), [`06cd3cb`](https://github.com/mastra-ai/mastra/commit/06cd3cb379730467a8c619cfbcc1952bdcfd9a57), [`7a5c69e`](https://github.com/mastra-ai/mastra/commit/7a5c69e59d6f23b68c44887b15a674715e8c876f), [`53ef78f`](https://github.com/mastra-ai/mastra/commit/53ef78fa1314549de9e3ac8fd7bf57941112e316), [`6bcfd47`](https://github.com/mastra-ai/mastra/commit/6bcfd4786b447b1aa2032ed97d9ed048b7cd917d), [`26ba58b`](https://github.com/mastra-ai/mastra/commit/26ba58b3c2306d895ac895c49160b384a52db84d), [`38db399`](https://github.com/mastra-ai/mastra/commit/38db399371758dde19444f1b7f2a35048d29e0b0), [`a793ec2`](https://github.com/mastra-ai/mastra/commit/a793ec23949ee59b4aa850d83f9e1eba365ac5c8), [`9131d74`](https://github.com/mastra-ai/mastra/commit/9131d7459cfbd67037b7ea2515fcf22b60c213f3), [`196fd89`](https://github.com/mastra-ai/mastra/commit/196fd89df87b1675adcff0d4eeb1cd75965e40cb), [`b1a5896`](https://github.com/mastra-ai/mastra/commit/b1a5896196764500614cd435c48c6364a00e8726), [`0a37598`](https://github.com/mastra-ai/mastra/commit/0a375986869049865023d765337db427b6e27436), [`3acf1e3`](https://github.com/mastra-ai/mastra/commit/3acf1e36e26835caac9c22764bc87ee536ef5a62), [`0fbbd4b`](https://github.com/mastra-ai/mastra/commit/0fbbd4bb57f0541fc6a608c0747311bb04aa403d), [`7a046c6`](https://github.com/mastra-ai/mastra/commit/7a046c6a75c27d9859d695a59f6b3e8a96f6bfc8), [`9168424`](https://github.com/mastra-ai/mastra/commit/9168424453b5c0d793e0ddaa8066dceec60f619a), [`e1478fc`](https://github.com/mastra-ai/mastra/commit/e1478fc0cb9284f2e6fca7e582381c06749e2c06), [`6efbfad`](https://github.com/mastra-ai/mastra/commit/6efbfad1d763f54a2b346579d43a67ad0d92ce42), [`6cb981b`](https://github.com/mastra-ai/mastra/commit/6cb981bc62994e4c775864204617af70a7db3c4a), [`fb03761`](https://github.com/mastra-ai/mastra/commit/fb0376186c5fc8fc633c38d13a8dcc7c976318d8), [`1d94199`](https://github.com/mastra-ai/mastra/commit/1d94199fbb65d5acbcd0101bcbac96876e35cac4), [`018ae9d`](https://github.com/mastra-ai/mastra/commit/018ae9d2f4ebfd3bd6f267d0010171a546cb3abf), [`718207d`](https://github.com/mastra-ai/mastra/commit/718207d5cc37d625bea6ff290fe25a949d3594f6), [`b8be029`](https://github.com/mastra-ai/mastra/commit/b8be0295bf88782f95702e65349a714d03a787d1), [`3e7a81b`](https://github.com/mastra-ai/mastra/commit/3e7a81b4e9b2c9de440b85b315a8297418afbaca), [`8fd2313`](https://github.com/mastra-ai/mastra/commit/8fd23138d68dd1b1b324a45db645c4968df45751), [`c3caa9a`](https://github.com/mastra-ai/mastra/commit/c3caa9a04cfa7652a9e5e214839285074eaa3f05), [`077dc71`](https://github.com/mastra-ai/mastra/commit/077dc7181a69bd473319ce1c48f7fd2fcdf95b97), [`718207d`](https://github.com/mastra-ai/mastra/commit/718207d5cc37d625bea6ff290fe25a949d3594f6), [`c498e24`](https://github.com/mastra-ai/mastra/commit/c498e249038d08a2e2fc31eed7ba4ca5e7fa1aa8), [`873b67e`](https://github.com/mastra-ai/mastra/commit/873b67e1e80e33cedf1809bf51f342cf7e9e654f), [`c96dab0`](https://github.com/mastra-ai/mastra/commit/c96dab05e69601667bc237ff2b27b9cb7d1f50c6), [`6a4f0bd`](https://github.com/mastra-ai/mastra/commit/6a4f0bd01016fba8d8dea5159a18c6a400237256), [`a4b2030`](https://github.com/mastra-ai/mastra/commit/a4b2030f6a1cb7123530f99d06f2b9e461e63932), [`2a48242`](https://github.com/mastra-ai/mastra/commit/2a48242a18f7444896bf8c7054fb59c0afae050e), [`9a3513c`](https://github.com/mastra-ai/mastra/commit/9a3513c18ec2d8b12174620a2a6db968760b9141), [`bf0dd07`](https://github.com/mastra-ai/mastra/commit/bf0dd07091a3685fa14923355413f0166ba9c5bf), [`07440af`](https://github.com/mastra-ai/mastra/commit/07440affa587b68f8348eb68e92fc1aa1817b61f), [`499f480`](https://github.com/mastra-ai/mastra/commit/499f480c86ba137356367e6b6281ba02b42d8169), [`bb57489`](https://github.com/mastra-ai/mastra/commit/bb5748958b6d404619884f7e04a0d7619fdebae7), [`a879630`](https://github.com/mastra-ai/mastra/commit/a879630e3f8c696fdaa61e4103b8bb052b97730e), [`045d583`](https://github.com/mastra-ai/mastra/commit/045d583852e55d0c1c518d2f5f9c33b48243cf7d), [`4ec3ccd`](https://github.com/mastra-ai/mastra/commit/4ec3ccde9924c27e7320f7bbe26c932731b7b4cd), [`3439cb2`](https://github.com/mastra-ai/mastra/commit/3439cb236f17bd248a326ff7f2c934cfb9974936), [`b8be029`](https://github.com/mastra-ai/mastra/commit/b8be0295bf88782f95702e65349a714d03a787d1), [`717efe7`](https://github.com/mastra-ai/mastra/commit/717efe7f4a742eebe6571d24a89c1fcc55febd28)]:
  - @mastra/core@1.75.0
  - @mastra/duckdb@1.13.0
  - @mastra/mcp@2.2.0
  - @mastra/memory@1.36.0
  - @mastra/observability@1.18.4
  - @mastra/pg@1.30.0
  - @mastra/libsql@1.25.1

## 1.11.0-alpha.10

### Patch Changes

- Updated dependencies [[`f0305e9`](https://github.com/mastra-ai/mastra/commit/f0305e95779240bbd54fe44f5cca518478eeef6d), [`e554c6d`](https://github.com/mastra-ai/mastra/commit/e554c6d7ff40805950f37a230ede4e2db82fc426), [`7736c40`](https://github.com/mastra-ai/mastra/commit/7736c40dedd54ce840f834f7de862e64895cd3a8), [`bf982e9`](https://github.com/mastra-ai/mastra/commit/bf982e91512d5fb864984b44e649f104b7a9d7a4), [`da4eac9`](https://github.com/mastra-ai/mastra/commit/da4eac96c1856b81dd132183bccb3247de1d427f), [`539b958`](https://github.com/mastra-ai/mastra/commit/539b958da37c302f0b8bee5d9ce2b063c63ab09a), [`810b48d`](https://github.com/mastra-ai/mastra/commit/810b48dd77d992966a47ca5920e3c32267521b3a), [`7a5c69e`](https://github.com/mastra-ai/mastra/commit/7a5c69e59d6f23b68c44887b15a674715e8c876f), [`6bcfd47`](https://github.com/mastra-ai/mastra/commit/6bcfd4786b447b1aa2032ed97d9ed048b7cd917d), [`26ba58b`](https://github.com/mastra-ai/mastra/commit/26ba58b3c2306d895ac895c49160b384a52db84d), [`fb03761`](https://github.com/mastra-ai/mastra/commit/fb0376186c5fc8fc633c38d13a8dcc7c976318d8), [`6a4f0bd`](https://github.com/mastra-ai/mastra/commit/6a4f0bd01016fba8d8dea5159a18c6a400237256), [`07440af`](https://github.com/mastra-ai/mastra/commit/07440affa587b68f8348eb68e92fc1aa1817b61f), [`3439cb2`](https://github.com/mastra-ai/mastra/commit/3439cb236f17bd248a326ff7f2c934cfb9974936)]:
  - @mastra/observability@1.18.4-alpha.1
  - @mastra/core@1.75.0-alpha.8
  - @mastra/memory@1.36.0-alpha.6
  - @mastra/pg@1.30.0-alpha.6
  - @mastra/mcp@2.2.0-alpha.2

## 1.11.0-alpha.9

### Minor Changes

- Made the controller runtime independent of Mastra Code model packs. Hosts can now provide a generic modelRoute for fallback models, account routing, and observational-memory models. Removed disableModelPacks and activeModelPackId from the controller runtime state. ([#25997](https://github.com/mastra-ai/mastra/pull/25997))

  **Before**

  ```ts
  const code = await createMastraCode({ disableModelPacks: true });
  await session.state.set({ activeModelPackId: 'anthropic' });
  ```

  **After**

  ```ts
  const code = await createMastraCode();
  await session.state.set({
    modelRoute: {
      entries: [
        { id: 'primary', label: 'Primary', modelId: 'openai/gpt-5.6' },
        { id: 'fallback', label: 'Fallback', modelId: 'anthropic/claude-fable-5' },
      ],
    },
  });
  ```

### Patch Changes

- Fixed ACP model selection to apply the model and its compatible thinking level together. ([#26069](https://github.com/mastra-ai/mastra/pull/26069))

- Bumped probe-image-size to ^7.4.0 in @mastra/memory to pick up the fix for a quadratic-time denial of service in its SVG parser (GHSA-gjj5-9665-rwrc). Bumped the smol-toml pin in @mastra/code-sdk from 1.8.0 to 1.9.0 for a parser security fix. No API changes. ([#25966](https://github.com/mastra-ai/mastra/pull/25966))

- Updated dependencies [[`97644a7`](https://github.com/mastra-ai/mastra/commit/97644a78cafe8276026509c56a70108075e950b7), [`d253891`](https://github.com/mastra-ai/mastra/commit/d2538914d2305d905bc9ed1dc7928b7f7ecc931a), [`4cf860a`](https://github.com/mastra-ai/mastra/commit/4cf860a5a550a21fabce43010e6f1c95710e155c), [`dac82ea`](https://github.com/mastra-ai/mastra/commit/dac82eaa324b66acad38d468799fa4e66594107f), [`97644a7`](https://github.com/mastra-ai/mastra/commit/97644a78cafe8276026509c56a70108075e950b7), [`19a6380`](https://github.com/mastra-ai/mastra/commit/19a63803204ee9ebbbca77d9245801d6cd6f89b4), [`06cd3cb`](https://github.com/mastra-ai/mastra/commit/06cd3cb379730467a8c619cfbcc1952bdcfd9a57), [`38db399`](https://github.com/mastra-ai/mastra/commit/38db399371758dde19444f1b7f2a35048d29e0b0), [`0a37598`](https://github.com/mastra-ai/mastra/commit/0a375986869049865023d765337db427b6e27436), [`018ae9d`](https://github.com/mastra-ai/mastra/commit/018ae9d2f4ebfd3bd6f267d0010171a546cb3abf), [`c498e24`](https://github.com/mastra-ai/mastra/commit/c498e249038d08a2e2fc31eed7ba4ca5e7fa1aa8), [`bf0dd07`](https://github.com/mastra-ai/mastra/commit/bf0dd07091a3685fa14923355413f0166ba9c5bf), [`045d583`](https://github.com/mastra-ai/mastra/commit/045d583852e55d0c1c518d2f5f9c33b48243cf7d)]:
  - @mastra/core@1.75.0-alpha.7
  - @mastra/mcp@2.2.0-alpha.2
  - @mastra/memory@1.36.0-alpha.5
  - @mastra/pg@1.30.0-alpha.5

## 1.11.0-alpha.8

### Patch Changes

- Updated dependencies [[`a793ec2`](https://github.com/mastra-ai/mastra/commit/a793ec23949ee59b4aa850d83f9e1eba365ac5c8), [`499f480`](https://github.com/mastra-ai/mastra/commit/499f480c86ba137356367e6b6281ba02b42d8169), [`a879630`](https://github.com/mastra-ai/mastra/commit/a879630e3f8c696fdaa61e4103b8bb052b97730e)]:
  - @mastra/pg@1.30.0-alpha.4
  - @mastra/core@1.75.0-alpha.6
  - @mastra/memory@1.36.0-alpha.4

## 1.11.0-alpha.7

### Patch Changes

- Updated dependencies [[`4bae2c7`](https://github.com/mastra-ai/mastra/commit/4bae2c7d83a1194be5ecbe624469ec85053e4b81), [`9168424`](https://github.com/mastra-ai/mastra/commit/9168424453b5c0d793e0ddaa8066dceec60f619a), [`8a5278a`](https://github.com/mastra-ai/mastra/commit/8a5278a8ab3fc6d4ae81073c7cef100954b4f0ef), [`7a50f76`](https://github.com/mastra-ai/mastra/commit/7a50f76900eb1488f755090651deae87b57cbab1), [`6cb981b`](https://github.com/mastra-ai/mastra/commit/6cb981bc62994e4c775864204617af70a7db3c4a), [`616ef0f`](https://github.com/mastra-ai/mastra/commit/616ef0fa482a7724f5e93609ab4f3960e3784a17), [`9168424`](https://github.com/mastra-ai/mastra/commit/9168424453b5c0d793e0ddaa8066dceec60f619a), [`6cb981b`](https://github.com/mastra-ai/mastra/commit/6cb981bc62994e4c775864204617af70a7db3c4a), [`873b67e`](https://github.com/mastra-ai/mastra/commit/873b67e1e80e33cedf1809bf51f342cf7e9e654f), [`c96dab0`](https://github.com/mastra-ai/mastra/commit/c96dab05e69601667bc237ff2b27b9cb7d1f50c6), [`717efe7`](https://github.com/mastra-ai/mastra/commit/717efe7f4a742eebe6571d24a89c1fcc55febd28)]:
  - @mastra/duckdb@1.13.0-alpha.3
  - @mastra/memory@1.36.0-alpha.3
  - @mastra/core@1.75.0-alpha.5
  - @mastra/mcp@2.2.0-alpha.1
  - @mastra/pg@1.30.0-alpha.3

## 1.11.0-alpha.6

### Patch Changes

- Updated dependencies [[`32fbecb`](https://github.com/mastra-ai/mastra/commit/32fbecb00efffa19c1b36b18e3411ff9ed14fac0), [`9c5fd7d`](https://github.com/mastra-ai/mastra/commit/9c5fd7dd5468d4b029d1015a711b328010a71484), [`9c5fd7d`](https://github.com/mastra-ai/mastra/commit/9c5fd7dd5468d4b029d1015a711b328010a71484), [`ce51958`](https://github.com/mastra-ai/mastra/commit/ce5195800c77c90141ee38684b4b163006dd56ff), [`a3d23f9`](https://github.com/mastra-ai/mastra/commit/a3d23f9c2ea1283001b06dffd5015f798bf75d9d), [`0fbbd4b`](https://github.com/mastra-ai/mastra/commit/0fbbd4bb57f0541fc6a608c0747311bb04aa403d), [`8fd2313`](https://github.com/mastra-ai/mastra/commit/8fd23138d68dd1b1b324a45db645c4968df45751)]:
  - @mastra/duckdb@1.13.0-alpha.2
  - @mastra/observability@1.18.4-alpha.0
  - @mastra/core@1.75.0-alpha.4
  - @mastra/mcp@2.2.0-alpha.0

## 1.11.0-alpha.5

### Minor Changes

- Editors that connect to Mastra Code over ACP (Agent Client Protocol), such as Zed and JetBrains IDEs, can now sign you in without leaving the editor. ([#25871](https://github.com/mastra-ai/mastra/pull/25871))

  - Sign in with a ChatGPT subscription, Kimi For Coding, or xAI in the browser, started from the editor.
  - Editors that support terminal sign-in also get Claude and GitHub Copilot sign-in, plus `mastracode-login` for any other provider or an API key. Each runs `mastracode login` in a terminal.
  - Starting a session with no configured provider returns an `auth_required` error, so editors show these sign-in options instead of a session with no usable model.
  - New sessions start on a model you can use. If the default model's provider isn't configured, the session switches to the default model of a provider you signed in to.

  ```ts
  const { authMethods } = await connection.initialize({
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: { auth: { terminal: true } },
  });
  // openai-codex, kimi-for-coding, xai, anthropic, github-copilot, mastracode-login

  await connection.authenticate({ methodId: 'openai-codex' });
  ```

## 1.11.0-alpha.4

### Patch Changes

- Fixed Unix socket path handling so a thread ID can no longer place a socket outside its resource directory, whether or not cross-project agent discovery is enabled. Thread IDs that would reuse the lease or discovery socket names are rejected as well. ([#25876](https://github.com/mastra-ai/mastra/pull/25876))

## 1.11.0-alpha.3

### Patch Changes

- Improved ACP session shutdown by waiting up to two seconds for pending notification dispatch and stopping workers before closing session resources. ([#25875](https://github.com/mastra-ai/mastra/pull/25875))

- Updated dependencies [[`b1a5896`](https://github.com/mastra-ai/mastra/commit/b1a5896196764500614cd435c48c6364a00e8726), [`b1a5896`](https://github.com/mastra-ai/mastra/commit/b1a5896196764500614cd435c48c6364a00e8726), [`757b1e4`](https://github.com/mastra-ai/mastra/commit/757b1e48e8645fd99551b0af9e8ce1b415f876ea), [`d2f2243`](https://github.com/mastra-ai/mastra/commit/d2f2243ed0d3190b685d0b1a9349ca00a95ce647), [`056427c`](https://github.com/mastra-ai/mastra/commit/056427cda3e9b7c064e55daaa688601807806840), [`b1a5896`](https://github.com/mastra-ai/mastra/commit/b1a5896196764500614cd435c48c6364a00e8726)]:
  - @mastra/duckdb@1.13.0-alpha.1
  - @mastra/pg@1.30.0-alpha.2
  - @mastra/core@1.75.0-alpha.3
  - @mastra/memory@1.36.0-alpha.2

## 1.11.0-alpha.2

### Minor Changes

- Agents in different projects on the same machine can now find each other. With cross-agent communication on (`crossAgentSignals: true` or the `signals.experimentalCrossAgentSignals` setting), `agent_connections_list` lists Mastra Code instances in every project, and `agent_connect` and `agent_signal_send` reach them. Before, the list only showed instances in the same project. ([#25758](https://github.com/mastra-ai/mastra/pull/25758))

  ```ts
  import { createMastraCode } from '@mastra/code-sdk';

  const mastraCode = await createMastraCode({
    unixSocketPubSub: true,
    crossAgentSignals: true,
  });
  ```

  An instance whose resource ID (from `MASTRA_RESOURCE_ID` or `.mastracode/database.json`) can't be used as a directory name, for example one containing `/`, stays out of cross-project discovery and logs one warning at startup.

  Any local process running as the same user can discover and message advertised agents. Set `MASTRACODE_SIGNALS_SOCKET_ROOT` to an absolute path to keep an instance or a test away from the shared `/tmp/mc` directory.

  Also fixed signal sockets piling up under `/tmp/mc`. Every agent discovery request used to leave an open socket, and often a socket file, behind, so long-running instances could accumulate thousands. One-off discovery replies now close as soon as they're answered. Headless `mastracode --prompt` runs also close their signal sockets on exit instead of leaving the files behind.

### Patch Changes

- Bumped the ajv pin in the ACP validator script to 8.20.0. No runtime changes. ([#25816](https://github.com/mastra-ai/mastra/pull/25816))

- Updated dependencies [[`b0d2c38`](https://github.com/mastra-ai/mastra/commit/b0d2c387ec339229d878fdd9bbf6b6f87ec308b8), [`79b3c78`](https://github.com/mastra-ai/mastra/commit/79b3c7875c511a718526020e3442bca433787199), [`e5f53fe`](https://github.com/mastra-ai/mastra/commit/e5f53fe5965b22b274435bde05fd75f0b851e1e5), [`1f7133c`](https://github.com/mastra-ai/mastra/commit/1f7133cffb88a67c5e1109a67342fc72ae861e6a), [`3b03b05`](https://github.com/mastra-ai/mastra/commit/3b03b054281496e07201284f686b20b4dc2c51b1), [`bcc2ceb`](https://github.com/mastra-ai/mastra/commit/bcc2ceb951d5259d09cde558dd6b86015b096d5c), [`832f57d`](https://github.com/mastra-ai/mastra/commit/832f57da36a03e5a90bf3ccc90e9df26ecf7d59d), [`edf1ce6`](https://github.com/mastra-ai/mastra/commit/edf1ce69cc703f917cd2ee06488293a1f1d45597), [`824eb7f`](https://github.com/mastra-ai/mastra/commit/824eb7fef2eb3a52a63c59c2b879c7211294e5ae), [`648a4f3`](https://github.com/mastra-ai/mastra/commit/648a4f3ec442416816173e5fd64b97efd930df8d), [`01ac36b`](https://github.com/mastra-ai/mastra/commit/01ac36bf59295cf16d7a86c04f5776a4f1c98132), [`4c1bc9d`](https://github.com/mastra-ai/mastra/commit/4c1bc9d87fb5545b190e7e691331576781bffecf), [`f6fb6bc`](https://github.com/mastra-ai/mastra/commit/f6fb6bc2b0efadd6b744b6f73f07aa9800e5fc07), [`b0d2b33`](https://github.com/mastra-ai/mastra/commit/b0d2b336efd2a023a9f29218b442b386e42248f9), [`196fd89`](https://github.com/mastra-ai/mastra/commit/196fd89df87b1675adcff0d4eeb1cd75965e40cb), [`3acf1e3`](https://github.com/mastra-ai/mastra/commit/3acf1e36e26835caac9c22764bc87ee536ef5a62), [`7a046c6`](https://github.com/mastra-ai/mastra/commit/7a046c6a75c27d9859d695a59f6b3e8a96f6bfc8), [`6efbfad`](https://github.com/mastra-ai/mastra/commit/6efbfad1d763f54a2b346579d43a67ad0d92ce42), [`1d94199`](https://github.com/mastra-ai/mastra/commit/1d94199fbb65d5acbcd0101bcbac96876e35cac4), [`b8be029`](https://github.com/mastra-ai/mastra/commit/b8be0295bf88782f95702e65349a714d03a787d1), [`3e7a81b`](https://github.com/mastra-ai/mastra/commit/3e7a81b4e9b2c9de440b85b315a8297418afbaca), [`a4b2030`](https://github.com/mastra-ai/mastra/commit/a4b2030f6a1cb7123530f99d06f2b9e461e63932), [`bb57489`](https://github.com/mastra-ai/mastra/commit/bb5748958b6d404619884f7e04a0d7619fdebae7), [`4ec3ccd`](https://github.com/mastra-ai/mastra/commit/4ec3ccde9924c27e7320f7bbe26c932731b7b4cd), [`b8be029`](https://github.com/mastra-ai/mastra/commit/b8be0295bf88782f95702e65349a714d03a787d1)]:
  - @mastra/core@1.75.0-alpha.2
  - @mastra/duckdb@1.13.0-alpha.0
  - @mastra/mcp@2.2.0-alpha.0
  - @mastra/libsql@1.25.1-alpha.0
  - @mastra/pg@1.30.0-alpha.1

## 1.11.0-alpha.1

### Minor Changes

- Added a `createInitialThread` option to `createMastraCode()`. Set it to `false` to start without a thread; the first message creates one, so a session that's never used leaves no empty thread behind. The default is unchanged. ([#22561](https://github.com/mastra-ai/mastra/pull/22561))

  ```ts
  createMastraCode({ createInitialThread: false });
  ```

### Patch Changes

- Updated dependencies [[`56eb894`](https://github.com/mastra-ai/mastra/commit/56eb894700575480c0e5d14a1ed7b633008610f2), [`cdf0d0b`](https://github.com/mastra-ai/mastra/commit/cdf0d0bcad55398a2022bbf10fe921ca801d09ac), [`ed8b01a`](https://github.com/mastra-ai/mastra/commit/ed8b01a81ebf018779571de5d9af63cdc61c5693), [`7e63f04`](https://github.com/mastra-ai/mastra/commit/7e63f0486ea13841fc64395e3c03866afa476449), [`7e63f04`](https://github.com/mastra-ai/mastra/commit/7e63f0486ea13841fc64395e3c03866afa476449), [`53ef78f`](https://github.com/mastra-ai/mastra/commit/53ef78fa1314549de9e3ac8fd7bf57941112e316), [`c3caa9a`](https://github.com/mastra-ai/mastra/commit/c3caa9a04cfa7652a9e5e214839285074eaa3f05), [`2a48242`](https://github.com/mastra-ai/mastra/commit/2a48242a18f7444896bf8c7054fb59c0afae050e), [`9a3513c`](https://github.com/mastra-ai/mastra/commit/9a3513c18ec2d8b12174620a2a6db968760b9141)]:
  - @mastra/core@1.75.0-alpha.1
  - @mastra/memory@1.36.0-alpha.1
  - @mastra/pg@1.30.0-alpha.0

## 1.10.2-alpha.0

### Patch Changes

- Observational memory and thread-title calls on Anthropic no longer write their whole prompt to the 1-hour prompt cache. Each call sends different conversation content, so that cache entry was never read. They now cache only their shared instructions for 5 minutes, which the next observer call reads. The main agent still uses the 1-hour cache. ([#25739](https://github.com/mastra-ai/mastra/pull/25739))

- Fixed Mastra Code starting a second agent run on a thread that was already running in another project's Mastra Code process. Every local Mastra Code process shares one database, so any of them could pick up a notification meant for another project's thread, see that thread as idle, and run it with its own session and workspace. ([#25741](https://github.com/mastra-ai/mastra/pull/25741))

  Mastra Code processes now coordinate a thread's runs no matter which project they belong to, so a busy thread stays busy for every process. Each process delivers the due notifications of its own sessions' resources itself, and only one process delivers a resource's notifications at a time, so a notification is never run by a process that cannot own its thread.

- Mastra Code now caches prompts for 1 hour instead of 5 minutes on direct Anthropic connections (API key or Claude subscription), and waits for 1 hour of idle time before activating buffered observations on those models. Claude through other providers, such as Amazon Bedrock, keeps the 5-minute behavior. Coming back to a conversation after a break of up to an hour reuses the cached prompt instead of resending it in full. ([#25727](https://github.com/mastra-ai/mastra/pull/25727))

  **Cost tradeoff:** writing a 1-hour cache entry costs 2× the base input price, compared with 1.25× for a 5-minute entry. Cache reads cost the same. Sessions that pause for between 5 minutes and an hour can come out cheaper because they read the cache instead of rewriting it. Sessions that never pause that long pay more for every cache write.

  The 1-hour cache also applies to Anthropic models used for memory observation, reflection, and thread titles, since they go through the same model setup.

- Updated dependencies [[`b54fda3`](https://github.com/mastra-ai/mastra/commit/b54fda3f30330d65e52bf34802f0aa4035e30ef8), [`06e3dcf`](https://github.com/mastra-ai/mastra/commit/06e3dcf59aa937d8d5ab4de61b87465dfe38a62d), [`06496a9`](https://github.com/mastra-ai/mastra/commit/06496a961baaa86178efe24be052107ea019d649), [`9d4f647`](https://github.com/mastra-ai/mastra/commit/9d4f647c52ac5701f04ff320399d01b4cc2f0942), [`b9c0fe5`](https://github.com/mastra-ai/mastra/commit/b9c0fe5e4cc4bc1758a7569837ae9e76a6e35839), [`847a426`](https://github.com/mastra-ai/mastra/commit/847a426fc2158fdec7c939e576e8072c7998f2e3), [`9131d74`](https://github.com/mastra-ai/mastra/commit/9131d7459cfbd67037b7ea2515fcf22b60c213f3), [`e1478fc`](https://github.com/mastra-ai/mastra/commit/e1478fc0cb9284f2e6fca7e582381c06749e2c06), [`718207d`](https://github.com/mastra-ai/mastra/commit/718207d5cc37d625bea6ff290fe25a949d3594f6), [`077dc71`](https://github.com/mastra-ai/mastra/commit/077dc7181a69bd473319ce1c48f7fd2fcdf95b97), [`718207d`](https://github.com/mastra-ai/mastra/commit/718207d5cc37d625bea6ff290fe25a949d3594f6)]:
  - @mastra/core@1.75.0-alpha.0
  - @mastra/memory@1.36.0-alpha.0

## 1.10.1

### Patch Changes

- Updated dependencies [[`ac54c46`](https://github.com/mastra-ai/mastra/commit/ac54c4617d1bebffe9e4c1034e084e25528a94c9), [`a86dc42`](https://github.com/mastra-ai/mastra/commit/a86dc424052b8dfbbf7eadb60a9c2acadbc0abc8), [`a86dc42`](https://github.com/mastra-ai/mastra/commit/a86dc424052b8dfbbf7eadb60a9c2acadbc0abc8), [`580c22b`](https://github.com/mastra-ai/mastra/commit/580c22b8d413bf6e61ab27bb2043b96e4e84bd99), [`a86dc42`](https://github.com/mastra-ai/mastra/commit/a86dc424052b8dfbbf7eadb60a9c2acadbc0abc8), [`acb22d7`](https://github.com/mastra-ai/mastra/commit/acb22d75570a734921749c3c9ba590e671bddd9f)]:
  - @mastra/core@1.74.0
  - @mastra/memory@1.35.0
  - @mastra/libsql@1.25.0
  - @mastra/pg@1.29.0

## 1.10.1-alpha.1

### Patch Changes

- Updated dependencies [[`acb22d7`](https://github.com/mastra-ai/mastra/commit/acb22d75570a734921749c3c9ba590e671bddd9f)]:
  - @mastra/core@1.73.1-alpha.1

## 1.10.1-alpha.0

### Patch Changes

- Updated dependencies [[`ac54c46`](https://github.com/mastra-ai/mastra/commit/ac54c4617d1bebffe9e4c1034e084e25528a94c9), [`580c22b`](https://github.com/mastra-ai/mastra/commit/580c22b8d413bf6e61ab27bb2043b96e4e84bd99)]:
  - @mastra/core@1.73.1-alpha.0

## 1.10.0

### Minor Changes

- Added an opt-in experimental agent runtime for validating Mastra Code on durable and evented execution. ([#25359](https://github.com/mastra-ai/mastra/pull/25359))

  **Before**

  ```bash
  mastracode
  ```

  Mastra Code always used the standard coding agent.

  **After**

  ```bash
  MASTRACODE_EXPERIMENTAL_AGENT=durable mastracode
  MASTRACODE_EXPERIMENTAL_AGENT=evented mastracode
  ```

  The SDK now wraps the coding agent with the requested implementation, rejects invalid or unsupported configurations at startup, and reports the resolved workflow engine.

### Patch Changes

- Mastra Code now uses the shared error recovery defaults from `@mastra/core`. It still repairs rejected message history and assistant-prefill errors before it retries, and it keeps its own tuned retry settings for network and server errors. ([#24473](https://github.com/mastra-ai/mastra/pull/24473))

- Subagents now resolve models the same way the main agent does, including custom providers and tenant credentials from the calling run. Model IDs owned by another registered gateway still go to that gateway. ([#25482](https://github.com/mastra-ai/mastra/pull/25482))

  Behavior change for Factory: tenant subagents no longer fall back to the server's environment API keys (such as `ANTHROPIC_API_KEY`). A subagent whose provider isn't connected for the signed-in account now fails with a missing-credential error, matching the main agent. Connect the provider or add an org credential for those accounts.

- Fixed account switching and removal across multiple running Mastra Code instances. Each instance now uses the latest accounts, including in `/login`. ([#25517](https://github.com/mastra-ai/mastra/pull/25517))

  - Requests using automatic account routing retry on a remaining account when another instance removes the account they were using.
  - Requests routed to a specific account stop instead of switching to a different account when that account is removed. Applying that account no longer shows a notice on every prompt, but failover notices still appear.

- Generate Factory, CLI, channel, and signal identifiers with Web Crypto while retaining synchronous interfaces. ([#25462](https://github.com/mastra-ai/mastra/pull/25462))

- Fixed headless runs without thread options to start a fresh thread instead of reusing the current thread. ([#25594](https://github.com/mastra-ai/mastra/pull/25594))

- Updated dependencies [[`bf8915a`](https://github.com/mastra-ai/mastra/commit/bf8915a00a4bc2cdacbbf94f6b9628cda5ad872c), [`42b8761`](https://github.com/mastra-ai/mastra/commit/42b8761d917453cfe9b0b189c51442a5398fbf27), [`c260e42`](https://github.com/mastra-ai/mastra/commit/c260e429ff30cc19859555985cacd5b70cfd63d9), [`d777c00`](https://github.com/mastra-ai/mastra/commit/d777c0041c127f3223ecb69e479f0fde6453a085), [`2588009`](https://github.com/mastra-ai/mastra/commit/25880090300e3e5810057323ff22c743f090d315), [`9a30e77`](https://github.com/mastra-ai/mastra/commit/9a30e7768d3ac704e3940bae24b7aafc7eb6cf23), [`4e9f39b`](https://github.com/mastra-ai/mastra/commit/4e9f39b0be3b49e9df4586c08d4eec1b6ab5c37c), [`4228a4e`](https://github.com/mastra-ai/mastra/commit/4228a4e13b18f09b2c6281ebeec6ea76dbd9ba4d), [`c4c5397`](https://github.com/mastra-ai/mastra/commit/c4c539745afe736a4be0304784e3ec5d1a41f39b), [`9762b12`](https://github.com/mastra-ai/mastra/commit/9762b125c480ee8bdb887145f4044a69eb18e27f), [`c1a0491`](https://github.com/mastra-ai/mastra/commit/c1a049108588b49eff57461c4f294c9459397933), [`8cf6a36`](https://github.com/mastra-ai/mastra/commit/8cf6a364f74ae7d2807689519735974dc7e527b6), [`279d4a7`](https://github.com/mastra-ai/mastra/commit/279d4a7acba086eac37f49471ed30734eecec490), [`dbeb617`](https://github.com/mastra-ai/mastra/commit/dbeb617af5e3f7150ab412ea03f85d6869d49537), [`2302827`](https://github.com/mastra-ai/mastra/commit/2302827442eb5eb7d7039c70b61165b85a401c3b), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`3da569c`](https://github.com/mastra-ai/mastra/commit/3da569c2032b3ec32a818f47f942151926c8fd6a), [`23da871`](https://github.com/mastra-ai/mastra/commit/23da871c62bee9a4628d64afe8f3a154b8c7322b), [`c4b52a2`](https://github.com/mastra-ai/mastra/commit/c4b52a20b533b92cab1a0478e8bab66231cefb86), [`63b8630`](https://github.com/mastra-ai/mastra/commit/63b8630cf4f7f3b330c872a21ae0cfedf0b4978a), [`c3b3801`](https://github.com/mastra-ai/mastra/commit/c3b38019e60d41c4ef8cae328523e461dd45ea71), [`bc1d827`](https://github.com/mastra-ai/mastra/commit/bc1d82750d4d4d336f8e0215f256eb69b804e1f8), [`df91bae`](https://github.com/mastra-ai/mastra/commit/df91bae13d880242f755031cc4bcfbe2d3102c06), [`2f8cb4d`](https://github.com/mastra-ai/mastra/commit/2f8cb4d7237372a7dff899bf3b4cbf4060b007db), [`e8f60c7`](https://github.com/mastra-ai/mastra/commit/e8f60c762a8335071418aaf04db4363ac0120e3a), [`c260e42`](https://github.com/mastra-ai/mastra/commit/c260e429ff30cc19859555985cacd5b70cfd63d9), [`9d304f4`](https://github.com/mastra-ai/mastra/commit/9d304f452c761403a726a9a518d6678019af23ca), [`39a9907`](https://github.com/mastra-ai/mastra/commit/39a99070c1acdb7227cbe26b73860bec47cea564), [`af7e837`](https://github.com/mastra-ai/mastra/commit/af7e837cf6274f98c35c1dcda345188df8891932), [`e6594a4`](https://github.com/mastra-ai/mastra/commit/e6594a47e870cf450bacb886a22c0b94044f8fdf), [`e7e67f6`](https://github.com/mastra-ai/mastra/commit/e7e67f6f300a77869c9e5b65d6a8577b3b3a16a0), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`e9276f4`](https://github.com/mastra-ai/mastra/commit/e9276f45c6c1a222890334209d24e8917e4f6ad1), [`fab9ba1`](https://github.com/mastra-ai/mastra/commit/fab9ba1687199a8284ea51034d049fcd232fb7dd), [`1d13e8c`](https://github.com/mastra-ai/mastra/commit/1d13e8c4f50315c742a36525b1d30a1ecfa3a423), [`8acf89f`](https://github.com/mastra-ai/mastra/commit/8acf89ff090ab4666de8fa1452239fbd4080b216), [`0b9e7bc`](https://github.com/mastra-ai/mastra/commit/0b9e7bc0839bcec59f9eaa014c759ae935454c45), [`bd7a8bb`](https://github.com/mastra-ai/mastra/commit/bd7a8bbed9efd6d851dd0fea4828fdd3ddffa8b0), [`270e05f`](https://github.com/mastra-ai/mastra/commit/270e05fec0ec934c564527e33d0f51768712ad79), [`beb81b1`](https://github.com/mastra-ai/mastra/commit/beb81b1b01740c79895049187dc96008723dab92), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`4ac8bc7`](https://github.com/mastra-ai/mastra/commit/4ac8bc76e97278370f4ee0efabe71e9295f8f03f), [`961c668`](https://github.com/mastra-ai/mastra/commit/961c6684ae23bfe1e014d14b9def61e9518fcdf0), [`ab42292`](https://github.com/mastra-ai/mastra/commit/ab42292369c62b847ae4039e4dcf07b0a1116966), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`d777c00`](https://github.com/mastra-ai/mastra/commit/d777c0041c127f3223ecb69e479f0fde6453a085), [`5d8b27d`](https://github.com/mastra-ai/mastra/commit/5d8b27df7306759b7d065f8a968d4e250ceae7d4), [`9762b12`](https://github.com/mastra-ai/mastra/commit/9762b125c480ee8bdb887145f4044a69eb18e27f), [`4d08d94`](https://github.com/mastra-ai/mastra/commit/4d08d94665308961452cb1a3a06d040da3d01b4b), [`d7c35a2`](https://github.com/mastra-ai/mastra/commit/d7c35a2fc17d692c4397c59d34f7cdbe4398cc3f), [`cdaf888`](https://github.com/mastra-ai/mastra/commit/cdaf88896503e3fe04465754a8a0a469ceb9d360)]:
  - @mastra/core@1.73.0
  - @mastra/memory@1.34.0
  - @mastra/libsql@1.24.1
  - @mastra/duckdb@1.12.1
  - @mastra/pg@1.28.1
  - @mastra/observability@1.18.3
  - @mastra/github-signals@0.5.1
  - @mastra/schema-compat@1.3.13
  - @mastra/mcp@2.1.2

## 1.10.0-alpha.1

### Patch Changes

- Fixed headless runs without thread options to start a fresh thread instead of reusing the current thread. ([#25594](https://github.com/mastra-ai/mastra/pull/25594))

- Updated dependencies [[`bf8915a`](https://github.com/mastra-ai/mastra/commit/bf8915a00a4bc2cdacbbf94f6b9628cda5ad872c), [`2588009`](https://github.com/mastra-ai/mastra/commit/25880090300e3e5810057323ff22c743f090d315), [`4228a4e`](https://github.com/mastra-ai/mastra/commit/4228a4e13b18f09b2c6281ebeec6ea76dbd9ba4d), [`c4c5397`](https://github.com/mastra-ai/mastra/commit/c4c539745afe736a4be0304784e3ec5d1a41f39b), [`c1a0491`](https://github.com/mastra-ai/mastra/commit/c1a049108588b49eff57461c4f294c9459397933), [`8cf6a36`](https://github.com/mastra-ai/mastra/commit/8cf6a364f74ae7d2807689519735974dc7e527b6), [`dbeb617`](https://github.com/mastra-ai/mastra/commit/dbeb617af5e3f7150ab412ea03f85d6869d49537), [`2302827`](https://github.com/mastra-ai/mastra/commit/2302827442eb5eb7d7039c70b61165b85a401c3b), [`23da871`](https://github.com/mastra-ai/mastra/commit/23da871c62bee9a4628d64afe8f3a154b8c7322b), [`c3b3801`](https://github.com/mastra-ai/mastra/commit/c3b38019e60d41c4ef8cae328523e461dd45ea71), [`bc1d827`](https://github.com/mastra-ai/mastra/commit/bc1d82750d4d4d336f8e0215f256eb69b804e1f8), [`df91bae`](https://github.com/mastra-ai/mastra/commit/df91bae13d880242f755031cc4bcfbe2d3102c06), [`e8f60c7`](https://github.com/mastra-ai/mastra/commit/e8f60c762a8335071418aaf04db4363ac0120e3a), [`af7e837`](https://github.com/mastra-ai/mastra/commit/af7e837cf6274f98c35c1dcda345188df8891932), [`e6594a4`](https://github.com/mastra-ai/mastra/commit/e6594a47e870cf450bacb886a22c0b94044f8fdf), [`fab9ba1`](https://github.com/mastra-ai/mastra/commit/fab9ba1687199a8284ea51034d049fcd232fb7dd), [`8acf89f`](https://github.com/mastra-ai/mastra/commit/8acf89ff090ab4666de8fa1452239fbd4080b216), [`beb81b1`](https://github.com/mastra-ai/mastra/commit/beb81b1b01740c79895049187dc96008723dab92), [`4ac8bc7`](https://github.com/mastra-ai/mastra/commit/4ac8bc76e97278370f4ee0efabe71e9295f8f03f), [`961c668`](https://github.com/mastra-ai/mastra/commit/961c6684ae23bfe1e014d14b9def61e9518fcdf0), [`d7c35a2`](https://github.com/mastra-ai/mastra/commit/d7c35a2fc17d692c4397c59d34f7cdbe4398cc3f), [`cdaf888`](https://github.com/mastra-ai/mastra/commit/cdaf88896503e3fe04465754a8a0a469ceb9d360)]:
  - @mastra/core@1.73.0-alpha.1
  - @mastra/libsql@1.24.1-alpha.1
  - @mastra/pg@1.28.1-alpha.1
  - @mastra/schema-compat@1.3.13-alpha.0
  - @mastra/mcp@2.1.2-alpha.0
  - @mastra/memory@1.34.0-alpha.1

## 1.10.0-alpha.0

### Minor Changes

- Added an opt-in experimental agent runtime for validating Mastra Code on durable and evented execution. ([#25359](https://github.com/mastra-ai/mastra/pull/25359))

  **Before**

  ```bash
  mastracode
  ```

  Mastra Code always used the standard coding agent.

  **After**

  ```bash
  MASTRACODE_EXPERIMENTAL_AGENT=durable mastracode
  MASTRACODE_EXPERIMENTAL_AGENT=evented mastracode
  ```

  The SDK now wraps the coding agent with the requested implementation, rejects invalid or unsupported configurations at startup, and reports the resolved workflow engine.

### Patch Changes

- Mastra Code now uses the shared error recovery defaults from `@mastra/core`. It still repairs rejected message history and assistant-prefill errors before it retries, and it keeps its own tuned retry settings for network and server errors. ([#24473](https://github.com/mastra-ai/mastra/pull/24473))

- Subagents now resolve models the same way the main agent does, including custom providers and tenant credentials from the calling run. Model IDs owned by another registered gateway still go to that gateway. ([#25482](https://github.com/mastra-ai/mastra/pull/25482))

  Behavior change for Factory: tenant subagents no longer fall back to the server's environment API keys (such as `ANTHROPIC_API_KEY`). A subagent whose provider isn't connected for the signed-in account now fails with a missing-credential error, matching the main agent. Connect the provider or add an org credential for those accounts.

- Fixed account switching and removal across multiple running Mastra Code instances. Each instance now uses the latest accounts, including in `/login`. ([#25517](https://github.com/mastra-ai/mastra/pull/25517))

  - Requests using automatic account routing retry on a remaining account when another instance removes the account they were using.
  - Requests routed to a specific account stop instead of switching to a different account when that account is removed. Applying that account no longer shows a notice on every prompt, but failover notices still appear.

- Generate Factory, CLI, channel, and signal identifiers with Web Crypto while retaining synchronous interfaces. ([#25462](https://github.com/mastra-ai/mastra/pull/25462))

- Updated dependencies [[`42b8761`](https://github.com/mastra-ai/mastra/commit/42b8761d917453cfe9b0b189c51442a5398fbf27), [`c260e42`](https://github.com/mastra-ai/mastra/commit/c260e429ff30cc19859555985cacd5b70cfd63d9), [`d777c00`](https://github.com/mastra-ai/mastra/commit/d777c0041c127f3223ecb69e479f0fde6453a085), [`9a30e77`](https://github.com/mastra-ai/mastra/commit/9a30e7768d3ac704e3940bae24b7aafc7eb6cf23), [`4e9f39b`](https://github.com/mastra-ai/mastra/commit/4e9f39b0be3b49e9df4586c08d4eec1b6ab5c37c), [`9762b12`](https://github.com/mastra-ai/mastra/commit/9762b125c480ee8bdb887145f4044a69eb18e27f), [`279d4a7`](https://github.com/mastra-ai/mastra/commit/279d4a7acba086eac37f49471ed30734eecec490), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`3da569c`](https://github.com/mastra-ai/mastra/commit/3da569c2032b3ec32a818f47f942151926c8fd6a), [`c4b52a2`](https://github.com/mastra-ai/mastra/commit/c4b52a20b533b92cab1a0478e8bab66231cefb86), [`63b8630`](https://github.com/mastra-ai/mastra/commit/63b8630cf4f7f3b330c872a21ae0cfedf0b4978a), [`2f8cb4d`](https://github.com/mastra-ai/mastra/commit/2f8cb4d7237372a7dff899bf3b4cbf4060b007db), [`c260e42`](https://github.com/mastra-ai/mastra/commit/c260e429ff30cc19859555985cacd5b70cfd63d9), [`9d304f4`](https://github.com/mastra-ai/mastra/commit/9d304f452c761403a726a9a518d6678019af23ca), [`39a9907`](https://github.com/mastra-ai/mastra/commit/39a99070c1acdb7227cbe26b73860bec47cea564), [`e7e67f6`](https://github.com/mastra-ai/mastra/commit/e7e67f6f300a77869c9e5b65d6a8577b3b3a16a0), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`e9276f4`](https://github.com/mastra-ai/mastra/commit/e9276f45c6c1a222890334209d24e8917e4f6ad1), [`1d13e8c`](https://github.com/mastra-ai/mastra/commit/1d13e8c4f50315c742a36525b1d30a1ecfa3a423), [`0b9e7bc`](https://github.com/mastra-ai/mastra/commit/0b9e7bc0839bcec59f9eaa014c759ae935454c45), [`bd7a8bb`](https://github.com/mastra-ai/mastra/commit/bd7a8bbed9efd6d851dd0fea4828fdd3ddffa8b0), [`270e05f`](https://github.com/mastra-ai/mastra/commit/270e05fec0ec934c564527e33d0f51768712ad79), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`ab42292`](https://github.com/mastra-ai/mastra/commit/ab42292369c62b847ae4039e4dcf07b0a1116966), [`bc826e8`](https://github.com/mastra-ai/mastra/commit/bc826e8fb1c0d0311b4675fcfcf5c4f6bc43efe6), [`d777c00`](https://github.com/mastra-ai/mastra/commit/d777c0041c127f3223ecb69e479f0fde6453a085), [`5d8b27d`](https://github.com/mastra-ai/mastra/commit/5d8b27df7306759b7d065f8a968d4e250ceae7d4), [`9762b12`](https://github.com/mastra-ai/mastra/commit/9762b125c480ee8bdb887145f4044a69eb18e27f), [`4d08d94`](https://github.com/mastra-ai/mastra/commit/4d08d94665308961452cb1a3a06d040da3d01b4b)]:
  - @mastra/core@1.73.0-alpha.0
  - @mastra/memory@1.34.0-alpha.0
  - @mastra/duckdb@1.12.1-alpha.0
  - @mastra/pg@1.28.1-alpha.0
  - @mastra/observability@1.18.3-alpha.0
  - @mastra/github-signals@0.5.1-alpha.0
  - @mastra/libsql@1.24.1-alpha.0
  - @mastra/mcp@2.1.2-alpha.0

## 1.9.0

### Minor Changes

- Added `@mastra/code-sdk/schedules` with a process-local `ThreadScheduler` that sends recurring prompts into a thread on wall-clock boundaries, following daylight saving changes like cron. ([#25476](https://github.com/mastra-ai/mastra/pull/25476))

  ```ts
  scheduler.create(
    {
      prompt: 'Check whether the build is green',
      trigger: { kind: 'every', interval: { ms: 5 * 60_000, label: '5m' } },
    },
    { threadId, resourceId },
  );
  ```

  A schedule's source is a prompt, a prompt file re-read on each fire, or a script whose output becomes the prompt. `run()` reports whether a manual fire was delivered, failed, skipped because it was already firing, or not found. The Mastra Code controller exposes the scheduler as `threadScheduler`, and `createScheduleTools()` builds agent tools for it, enabled with the `scheduleTools` config option or the `signals.experimentalScheduleTools` setting (off by default).

- Added model, mode, and reasoning selection for Agent Client Protocol clients: ([#24321](https://github.com/mastra-ai/mastra/pull/24321))

  ```ts
  await connection.setSessionConfigOption({
    sessionId,
    configId: 'thought_level',
    value: 'high',
  });
  ```

  Fixed user prompts and internal system messages appearing as assistant replies. Failed turns now return errors that clients can display; token limits and refusals return their corresponding protocol stop reasons.

  Each conversation now has its own runtime and uses the client's requested working directory. Client-supplied stdio and HTTP MCP servers connect with their configured environment variables or headers. Unsupported legacy SSE servers return an error before session startup.

  Tool approvals and sandbox access requests now ask the client for permission. Cancelling a session stops its active turn and queued prompts without interrupting other conversations. Shutdown waits for cleanup even when multiple signals arrive.

  Headless runs report session cancellation during startup as aborted while preserving provider and transport errors. Session creation retains its original error even if cleanup also fails.

  Model lists now omit unconfigured providers and retain full routing IDs in labels, preventing gateway entries from appearing to be direct provider models.

  Added workspace skill discovery and invocation for Agent Client Protocol clients. Clients can list user-invokable skills and activate them with an ordinary prompt:

  ```ts
  await connection.prompt({
    sessionId,
    prompt: [{ type: 'text', text: '/skill/review Check the current changes' }],
  });
  ```

  Skills marked `user-invocable: false` are hidden and cannot be invoked through slash commands.

### Patch Changes

- Mastra Code now retries once when OpenAI or Anthropic cybersecurity safeguards refuse ordinary coding work partway through a run, instead of stopping the run with a refusal error. ([#25172](https://github.com/mastra-ai/mastra/pull/25172))

  The behavior needs no configuration:

  ```ts
  import { mountAgentControllerOnMastra } from '@mastra/code-sdk';

  const { mastra, controller } = await mountAgentControllerOnMastra({ cwd: process.cwd() });
  ```

- Fixed cross-agent thread ownership so peers advertise the mastracode instance that currently owns the thread instead of an instance that only visited it earlier. ([#24898](https://github.com/mastra-ai/mastra/pull/24898))

  Sessions still keep every loaded thread advertised so saved peers remain reachable after `/new`. When another instance requests a thread that is no longer current, the SDK now transfers its lease during that claim attempt and forgets the yielded advertisement. A thread that is still current is retained, and retries succeed as soon as its current owner moves away. This prevents stale titles, missing peers, timeout races during event-loop stalls, and release-before-reclaim gaps.

- Fixed: mastracode no longer writes session scorer results into the local mastra.db. ([#23632](https://github.com/mastra-ai/mastra/pull/23632))

  The outcome and efficiency scorers run on every session and stored a result row each time, but nothing in mastracode ever read those rows back, so they only made the database grow. Scorer results are now discarded after each run instead of being kept on disk or in memory.

  **SDK change:** `createMastraCode().storage.getStore('scores')` now returns empty results from lookups and listings, including for scores already in the database. To read those older scores, open the database directly.

  Before:

  ```ts
  const { storage } = await createMastraCode();
  const scores = await storage.getStore('scores');
  const { scores: rows } = await scores!.listScoresByRunId({ runId, pagination: { page: 0, perPage: 50 } });
  ```

  After:

  ```ts
  import { LibSQLStore } from '@mastra/libsql';
  import { getDatabasePath } from '@mastra/code-sdk/utils/project';

  const store = new LibSQLStore({ id: 'mastra-code-scores', url: `file:${getDatabasePath()}` });
  const scores = await store.getStore('scores');
  const { scores: rows } = await scores!.listScoresByRunId({ runId, pagination: { page: 0, perPage: 50 } });
  ```

  Part of #22056.

- Fixed GitHub plugin installs failing when `package.json` declares pnpm with a Corepack integrity hash, such as `"packageManager": "pnpm@12.6.0+sha512.<hash>"` (the format written by `corepack use`). The hash is now accepted and passed to Corepack, which verifies the downloaded pnpm against it. ([#25121](https://github.com/mastra-ai/mastra/pull/25121))

- Quiet mode now shows a short description of each shell command, like `Drilling into the failed CI job`, instead of the raw command, so you can follow what the agent is doing without reading long commands and scripts. The agent is asked to write the description first and to phrase descriptions as a running narrative across commands. The description streams in as the agent writes it, and the raw command never flashes first. ([#25032](https://github.com/mastra-ai/mastra/pull/25032))

  Consecutive shell calls in the same directory share one compact box. When the quiet mode tool preview lines setting is 1 or more, the latest output streams into a shared preview at the top of the box:

  ```
  ╭──────────────────────────────────────────────────────────╮
  │  Test Files  3 passed (3)                                │
  │       Tests  42 passed (42)                              │
  ├──────────────────────────────────────────────────────────┤
  │ $ ~/code/my-project                                      │
  ├──────────────────────────────────────────────────────────┤
  │ ✓ Listing later commits touching the sandbox code  101ms │
  │ ✗ Checking the release tag                          1.5s │
  │   └▸ fatal: ambiguous argument 'v1.68.0..HEAD'           │
  │ ⠋ Running the sandbox test suite                      4s │
  ╰──────────────────────────────────────────────────────────╯
  ```

  Each directory gets its own box (subdirectories of the project show as `./path`), running commands show a spinner and a live timer, failed commands show their error line, and background commands are marked as started. With preview lines set to None, the box has no preview. Ctrl+E still reveals the full command and output.

- Added `mastracode prune`, which cleans up the local database from the shell instead of from inside the interactive session. ([#23632](https://github.com/mastra-ai/mastra/pull/23632))

  It deletes data older than the retention policies, and `--vacuum` returns the freed space to the operating system for a local libsql database (remote libsql and Postgres only delete rows). `--keep-memory` keeps chat history. This works even when the interactive session will not start, which previously left a large database with no way to reclaim it from inside the tool.

  ```bash
  mastracode prune                 # delete rows past the retention policies
  mastracode prune --vacuum        # ...then compact the files to reclaim disk
  mastracode prune --keep-memory   # ...but keep chat history
  ```

  `mastracode prune` and `/prune` refuse to run while another session is open, and a session started during either waits for it to finish. The lock lives in the app data directory, so sessions sharing one `MASTRA_DB_PATH` with different `MASTRA_APP_DATA_DIR` values don't see each other.

  Part of #22056.

- A routine goal save could delete a live goal. Saving used to double as deleting whenever no goal happened to be loaded in memory, so an empty ordinary save could remove the objective without explicit deletion intent. Saving now deletes only after an explicit clear; `/goal clear` still removes the goal and its older stored copy. If that delete fails, `/goal clear` now reports that the goal may still be active instead of claiming success, and switching back to the thread retries the delete rather than silently restoring the goal. ([#24618](https://github.com/mastra-ai/mastra/pull/24618))

  For anyone using `GoalManager` from `@mastra/code-sdk` directly: `clear()` followed by `saveToThread()` on the same thread still deletes the goal. The only change is that a save with no goal loaded, and no `clear()` before it, no longer deletes. `deleteFromThread` is also available to delete directly, and resolves to whether the delete landed:

  ```ts
  await goalManager.deleteFromThread(state);
  ```

- A paused goal now says why it paused. `/goal status` and the goal modal show the cause — evaluation budget exhausted, or a judge that failed to evaluate — and it survives a reload instead of disappearing after the moment it happened. Resuming or completing a goal clears the cause, so a later pause never shows a stale one. ([#24618](https://github.com/mastra-ai/mastra/pull/24618))

- **Approval prompts are now independent per thread and run.** Concurrent and detached approvals stop overwriting, stranding, or answering each other's gates: gates are keyed by tool call and tagged with the thread and run that opened them, abort and user-message interjection release only the current thread's gates, detached-thread approvals no longer fire notifications or permission hooks, and an approved run resumes against the thread, run, resource, agent, and cancellation signal that actually parked it — so a mode switch, resource re-scope, or a successor run cannot redirect or cancel the parked continuation. ([#24776](https://github.com/mastra-ai/mastra/pull/24776))

  **Approval responses now require the gate's `toolCallId`.** Without the id, a response could release whichever gate happened to be parked — another thread's or another run's — so an id-less response is rejected instead of silently applied. Every caller inside the repo already passes the id; this only affects external callers of the session API.

  Before:

  ```ts
  session.respondToToolApproval({ decision: 'approve' });
  ```

  After:

  ```ts
  session.respondToToolApproval({ decision: 'approve', toolCallId });
  ```

  Similarly, `SessionApproval.arm()` now requires a `toolCallId`, and `getToolCallId()` is replaced by `getToolCallIds()` (which accepts an optional thread/run filter).

  **"Always allow" grants are now scoped to the gate's thread.** Approving with `always_allow_category` grants the tool's category to the thread that owns the gate rather than the whole session, so a background thread's approval cannot widen what the current thread may run without prompting. `grantCategory`, `grantTool`, `hasCategoryGrant`, `hasToolGrant`, and `getGrants` accept an optional `threadId`; passing one scopes the grant to that thread, omitting it keeps the existing session-wide behavior for embedders that grant explicitly.

- Fixed agents receiving the host app's `AGENTS.md` when working in a different repository (for example, Mastra Factory runs). Instruction-file reminders now resolve relative paths against the session's project path and only load instruction files from inside that checkout. ([#25071](https://github.com/mastra-ai/mastra/pull/25071))

- Updated dependencies [[`9ce3444`](https://github.com/mastra-ai/mastra/commit/9ce3444d1a6b17e72b0a20c74603abaf252a843e), [`af4aed5`](https://github.com/mastra-ai/mastra/commit/af4aed50ad96b340d82a67c3f01cbf358b156ab2), [`43fbe75`](https://github.com/mastra-ai/mastra/commit/43fbe75535650345cf61dee00cf3e7b3f5efaf7f), [`e1c3193`](https://github.com/mastra-ai/mastra/commit/e1c3193b18ca68e5cca27f7dce9b0381a6e7b95d), [`afc53be`](https://github.com/mastra-ai/mastra/commit/afc53be4c95e83e8613f4e080b5a1926e63c5da6), [`4375206`](https://github.com/mastra-ai/mastra/commit/4375206131ff701405a20326be660b2e8c3742f8), [`4601dfa`](https://github.com/mastra-ai/mastra/commit/4601dfac7c2bfdf04f041b1725c8ac4ae92a8d7d), [`77c6f1c`](https://github.com/mastra-ai/mastra/commit/77c6f1cf14ba9ba47257829646a4569c4462d12f), [`9773cb2`](https://github.com/mastra-ai/mastra/commit/9773cb2f22f307c8017f887af4a6728c4cb875c9), [`3d25340`](https://github.com/mastra-ai/mastra/commit/3d2534080417711d1baf2ad947d1205ca95a34cd), [`5197f81`](https://github.com/mastra-ai/mastra/commit/5197f81d6a5641f80f0ee6596ac085653b38cca3), [`3b77788`](https://github.com/mastra-ai/mastra/commit/3b77788a08df1e754282d39c42823e6e1c5f2742), [`ebd03fd`](https://github.com/mastra-ai/mastra/commit/ebd03fd3bc93fe3930747956724252f7c8834826), [`63927e8`](https://github.com/mastra-ai/mastra/commit/63927e89c1b9db0fc87eef8503e3a03204f24b09), [`68cc668`](https://github.com/mastra-ai/mastra/commit/68cc66800e5ce6f5d62189fc7b5ef9d71cf80971), [`987257a`](https://github.com/mastra-ai/mastra/commit/987257a34cda8a153fe592c31d75fbb1dee55202), [`6946c4d`](https://github.com/mastra-ai/mastra/commit/6946c4db91071cb43fb36514a42a1e4ce05c37ba), [`65a93a2`](https://github.com/mastra-ai/mastra/commit/65a93a2a3b1434d605a6a417cb83d2d58e16bfc0), [`fd92729`](https://github.com/mastra-ai/mastra/commit/fd92729380a29f2a0ec822e39f3c09eb9aaa5ac5), [`b18d177`](https://github.com/mastra-ai/mastra/commit/b18d1776860af6bf5a4fcb1784ae952024fea87a), [`1818674`](https://github.com/mastra-ai/mastra/commit/18186744bebffdfecdca33e0b8b6a421cc95ed0d), [`5e799d9`](https://github.com/mastra-ai/mastra/commit/5e799d9098c5c4d1078bf90647e95db699be11ea), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`afc53be`](https://github.com/mastra-ai/mastra/commit/afc53be4c95e83e8613f4e080b5a1926e63c5da6), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`2c57ba8`](https://github.com/mastra-ai/mastra/commit/2c57ba896b04215fface2a8216b88fe59cfdd041), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`93fe2d6`](https://github.com/mastra-ai/mastra/commit/93fe2d6a9e47861d90cc0fd0080aefdb8cabb612), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`781762b`](https://github.com/mastra-ai/mastra/commit/781762b2dcd0c8cc7f9b8ab73824ec45a5225db7), [`4d187b7`](https://github.com/mastra-ai/mastra/commit/4d187b79d7ecce4d2f357f5fe385b414a532ff19), [`cc0da13`](https://github.com/mastra-ai/mastra/commit/cc0da13b826d5f74213c4d8c470acf8698542249), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`2a28888`](https://github.com/mastra-ai/mastra/commit/2a28888f7dfee74f84ec548c9c222cfd1aa7f393), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`f6effda`](https://github.com/mastra-ai/mastra/commit/f6effdabafa9fc6388478b3e281ad4c457d4200b), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`ec005d5`](https://github.com/mastra-ai/mastra/commit/ec005d517ea10b7742e67f7e75bf89259d72c37e), [`f2c3f8c`](https://github.com/mastra-ai/mastra/commit/f2c3f8c74e1d7bc7baca5303b36320b0b361775c), [`ed67acc`](https://github.com/mastra-ai/mastra/commit/ed67acc3213d469ed69610c304c604693cfec383), [`0c23429`](https://github.com/mastra-ai/mastra/commit/0c23429515b5c307e8a5759f5be1ce20d09d2347), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`b33985e`](https://github.com/mastra-ai/mastra/commit/b33985eac3e019f58d3785c48ef85eae48b4e068), [`cc0da13`](https://github.com/mastra-ai/mastra/commit/cc0da13b826d5f74213c4d8c470acf8698542249), [`c64bf75`](https://github.com/mastra-ai/mastra/commit/c64bf752dec931f5f6c8b3d5afc91a8b9aa670d8), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`79c3b1f`](https://github.com/mastra-ai/mastra/commit/79c3b1fa4d470585a00558b317ed47db9b1decd4), [`fbe37b7`](https://github.com/mastra-ai/mastra/commit/fbe37b7524f467a0bc43c55fb0662cb5e5cc3e16), [`4092ef2`](https://github.com/mastra-ai/mastra/commit/4092ef29aad09f2ba5f90c92a4d4d3bd444eae67), [`5f1efad`](https://github.com/mastra-ai/mastra/commit/5f1efad5c2230a4de715cad3f01859b4ff9d255b), [`68e8258`](https://github.com/mastra-ai/mastra/commit/68e8258560d09abdf8595488aff866f6e39c7913), [`32d71df`](https://github.com/mastra-ai/mastra/commit/32d71df2ce71573b40f9a62b8ac510ad6eadd859), [`7f4ce21`](https://github.com/mastra-ai/mastra/commit/7f4ce2190029710851d95f7b75a2fb724782483c), [`0391c26`](https://github.com/mastra-ai/mastra/commit/0391c265110641e148371442460ec4356b8b1667), [`e62e372`](https://github.com/mastra-ai/mastra/commit/e62e3721356955f0a9fd3d723cee9fa0c160652b), [`4b5b212`](https://github.com/mastra-ai/mastra/commit/4b5b212f1c5caa40a2d02308806bbe610f194503), [`75c2ee1`](https://github.com/mastra-ai/mastra/commit/75c2ee1280a5441eb66c31f23a53a52b42244686), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`3f50f2a`](https://github.com/mastra-ai/mastra/commit/3f50f2a59068fc91ef7ccc513e5d93845faa298e), [`3913a33`](https://github.com/mastra-ai/mastra/commit/3913a33fd5b13dc226b1ed6253c9357cb392dd04), [`1fe1c2b`](https://github.com/mastra-ai/mastra/commit/1fe1c2b6f0b29481dca62a9199af751d594e3ea6), [`d3a7dba`](https://github.com/mastra-ai/mastra/commit/d3a7dbaeb0d027e1e47e4e4ddb2ede271a007e17), [`13f03a4`](https://github.com/mastra-ai/mastra/commit/13f03a4e969384ccb63b81759a9e89a026b1fed8), [`64916c6`](https://github.com/mastra-ai/mastra/commit/64916c66e8d9dec107da2f81e7c1301471bf7bc3), [`08a0aea`](https://github.com/mastra-ai/mastra/commit/08a0aea2f2af12276e333c62aaf368a9240ff68f), [`561e2a6`](https://github.com/mastra-ai/mastra/commit/561e2a6c8a44dbfd91eae390e14671462497cf85), [`be9d1aa`](https://github.com/mastra-ai/mastra/commit/be9d1aa2c35acb6888d5fa69126f0f8e9a09bb47), [`64916c6`](https://github.com/mastra-ai/mastra/commit/64916c66e8d9dec107da2f81e7c1301471bf7bc3), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`444debd`](https://github.com/mastra-ai/mastra/commit/444debd7104ada74fa15d0e70703ee9be180fc75), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`1ba1588`](https://github.com/mastra-ai/mastra/commit/1ba158873dadf3d290b111981c3bc7ef95ab1d1c), [`9a35897`](https://github.com/mastra-ai/mastra/commit/9a3589783a40157759f939f5c63bba3c8aef1c1c), [`9997948`](https://github.com/mastra-ai/mastra/commit/99979482956903a2cd685b31f53370dd33074799), [`77c6f1c`](https://github.com/mastra-ai/mastra/commit/77c6f1cf14ba9ba47257829646a4569c4462d12f), [`0eb178e`](https://github.com/mastra-ai/mastra/commit/0eb178e3e06fd90d1f76faea8dbbaba8f97afa1f), [`279a736`](https://github.com/mastra-ai/mastra/commit/279a736c62495cac0f247ab1402a8c80bccc892a), [`d3a22a7`](https://github.com/mastra-ai/mastra/commit/d3a22a78f12e094118ce80ec35b63987009644e2), [`56fef1c`](https://github.com/mastra-ai/mastra/commit/56fef1cdd92a671c3de2cc5e4a319c637f700cf4), [`8156816`](https://github.com/mastra-ai/mastra/commit/815681621dd88997608c5b7e8f0f87fe03cd1d18), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`4d40bd9`](https://github.com/mastra-ai/mastra/commit/4d40bd91ccb00db163365a319b5d82bfb56a9ace), [`5e799d9`](https://github.com/mastra-ai/mastra/commit/5e799d9098c5c4d1078bf90647e95db699be11ea), [`94ba70e`](https://github.com/mastra-ai/mastra/commit/94ba70ea6ba8a53f5e4010392bf3bbaecde7966d), [`5197f81`](https://github.com/mastra-ai/mastra/commit/5197f81d6a5641f80f0ee6596ac085653b38cca3), [`d2f0cd7`](https://github.com/mastra-ai/mastra/commit/d2f0cd7c5d5f5f06cf5b65cf78a9f14ac052dbb1), [`6946c4d`](https://github.com/mastra-ai/mastra/commit/6946c4db91071cb43fb36514a42a1e4ce05c37ba), [`e4e0f90`](https://github.com/mastra-ai/mastra/commit/e4e0f9000d73396609ae2f2b6c31259ade43078c), [`7540eb1`](https://github.com/mastra-ai/mastra/commit/7540eb176c32ffbff45ccc64a8d8fce82ce42a94), [`c01f1ad`](https://github.com/mastra-ai/mastra/commit/c01f1ad358db0ab361fdb1b2f4f77c88540c2671), [`4cb7798`](https://github.com/mastra-ai/mastra/commit/4cb77987b5aeeb94b3dc955ae8ee0c2c227f8cfe), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`b537ab1`](https://github.com/mastra-ai/mastra/commit/b537ab14714870e058775530bc55b37c9115613f), [`14c54a9`](https://github.com/mastra-ai/mastra/commit/14c54a99d40a60d55fe9f12698824339c81500a8), [`4b5b212`](https://github.com/mastra-ai/mastra/commit/4b5b212f1c5caa40a2d02308806bbe610f194503), [`a7895fc`](https://github.com/mastra-ai/mastra/commit/a7895fce693e499c08c4784c57d4c4f46c0e1ccb), [`d8fcd39`](https://github.com/mastra-ai/mastra/commit/d8fcd397230a83f5fe9ef16e6b41237f057c2c29), [`5197f81`](https://github.com/mastra-ai/mastra/commit/5197f81d6a5641f80f0ee6596ac085653b38cca3), [`caf94f9`](https://github.com/mastra-ai/mastra/commit/caf94f9c1927f737370b6118264bd16c7210a765), [`9623397`](https://github.com/mastra-ai/mastra/commit/96233975b75135852c9b1616b91fd8cb54c77a53), [`5036e61`](https://github.com/mastra-ai/mastra/commit/5036e6179bee4105ad8f1fc57d315f78024565f4), [`4375206`](https://github.com/mastra-ai/mastra/commit/4375206131ff701405a20326be660b2e8c3742f8), [`676fcbf`](https://github.com/mastra-ai/mastra/commit/676fcbfc5f770ee45560c7b558b17ad5ff25d9e7), [`6c9f7ab`](https://github.com/mastra-ai/mastra/commit/6c9f7abf9bdce0a52450398b31d497519465bb80), [`d9790fd`](https://github.com/mastra-ai/mastra/commit/d9790fd00d95063de288560f6a0d2bac8f57cc4d), [`4375206`](https://github.com/mastra-ai/mastra/commit/4375206131ff701405a20326be660b2e8c3742f8), [`91196d5`](https://github.com/mastra-ai/mastra/commit/91196d5a6d582c0f494622d0378f33e22d881659), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0c2fe6c`](https://github.com/mastra-ai/mastra/commit/0c2fe6c00909795234270c8ea2c2c53882d63798), [`5e799d9`](https://github.com/mastra-ai/mastra/commit/5e799d9098c5c4d1078bf90647e95db699be11ea), [`f36019c`](https://github.com/mastra-ai/mastra/commit/f36019c24193e0d29f920663851198bf45e3d12f), [`5026973`](https://github.com/mastra-ai/mastra/commit/50269736f432cee1170627b2b6f88ba1431e837f), [`cc0da13`](https://github.com/mastra-ai/mastra/commit/cc0da13b826d5f74213c4d8c470acf8698542249), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`4edc93d`](https://github.com/mastra-ai/mastra/commit/4edc93dedadb89686aad75a4853cb0aa807d256e), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0eb178e`](https://github.com/mastra-ai/mastra/commit/0eb178e3e06fd90d1f76faea8dbbaba8f97afa1f), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`dd01709`](https://github.com/mastra-ai/mastra/commit/dd01709f780562f9ff8c72d977f3da5ae265970e), [`d4e350a`](https://github.com/mastra-ai/mastra/commit/d4e350a5c1e29a7da5a22da52ed1f33431403012)]:
  - @mastra/core@1.72.0
  - @mastra/observability@1.18.2
  - @mastra/libsql@1.24.0
  - @mastra/pg@1.28.0
  - @mastra/duckdb@1.12.0
  - @mastra/memory@1.33.0
  - @mastra/mcp@2.1.1
  - @mastra/schema-compat@1.3.12

## 1.9.0-alpha.10

### Minor Changes

- Added `@mastra/code-sdk/schedules` with a process-local `ThreadScheduler` that sends recurring prompts into a thread on wall-clock boundaries, following daylight saving changes like cron. ([#25476](https://github.com/mastra-ai/mastra/pull/25476))

  ```ts
  scheduler.create(
    {
      prompt: 'Check whether the build is green',
      trigger: { kind: 'every', interval: { ms: 5 * 60_000, label: '5m' } },
    },
    { threadId, resourceId },
  );
  ```

  A schedule's source is a prompt, a prompt file re-read on each fire, or a script whose output becomes the prompt. `run()` reports whether a manual fire was delivered, failed, skipped because it was already firing, or not found. The Mastra Code controller exposes the scheduler as `threadScheduler`, and `createScheduleTools()` builds agent tools for it, enabled with the `scheduleTools` config option or the `signals.experimentalScheduleTools` setting (off by default).

### Patch Changes

- Fixed: mastracode no longer writes session scorer results into the local mastra.db. ([#23632](https://github.com/mastra-ai/mastra/pull/23632))

  The outcome and efficiency scorers run on every session and stored a result row each time, but nothing in mastracode ever read those rows back, so they only made the database grow. Scorer results are now discarded after each run instead of being kept on disk or in memory.

  **SDK change:** `createMastraCode().storage.getStore('scores')` now returns empty results from lookups and listings, including for scores already in the database. To read those older scores, open the database directly.

  Before:

  ```ts
  const { storage } = await createMastraCode();
  const scores = await storage.getStore('scores');
  const { scores: rows } = await scores!.listScoresByRunId({ runId, pagination: { page: 0, perPage: 50 } });
  ```

  After:

  ```ts
  import { LibSQLStore } from '@mastra/libsql';
  import { getDatabasePath } from '@mastra/code-sdk/utils/project';

  const store = new LibSQLStore({ id: 'mastra-code-scores', url: `file:${getDatabasePath()}` });
  const scores = await store.getStore('scores');
  const { scores: rows } = await scores!.listScoresByRunId({ runId, pagination: { page: 0, perPage: 50 } });
  ```

  Part of #22056.

- Added `mastracode prune`, which cleans up the local database from the shell instead of from inside the interactive session. ([#23632](https://github.com/mastra-ai/mastra/pull/23632))

  It deletes data older than the retention policies, and `--vacuum` returns the freed space to the operating system for a local libsql database (remote libsql and Postgres only delete rows). `--keep-memory` keeps chat history. This works even when the interactive session will not start, which previously left a large database with no way to reclaim it from inside the tool.

  ```bash
  mastracode prune                 # delete rows past the retention policies
  mastracode prune --vacuum        # ...then compact the files to reclaim disk
  mastracode prune --keep-memory   # ...but keep chat history
  ```

  `mastracode prune` and `/prune` refuse to run while another session is open, and a session started during either waits for it to finish. The lock lives in the app data directory, so sessions sharing one `MASTRA_DB_PATH` with different `MASTRA_APP_DATA_DIR` values don't see each other.

  Part of #22056.

- Updated dependencies [[`ed67acc`](https://github.com/mastra-ai/mastra/commit/ed67acc3213d469ed69610c304c604693cfec383), [`5f1efad`](https://github.com/mastra-ai/mastra/commit/5f1efad5c2230a4de715cad3f01859b4ff9d255b), [`75c2ee1`](https://github.com/mastra-ai/mastra/commit/75c2ee1280a5441eb66c31f23a53a52b42244686), [`9a35897`](https://github.com/mastra-ai/mastra/commit/9a3589783a40157759f939f5c63bba3c8aef1c1c), [`d3a22a7`](https://github.com/mastra-ai/mastra/commit/d3a22a78f12e094118ce80ec35b63987009644e2), [`e4e0f90`](https://github.com/mastra-ai/mastra/commit/e4e0f9000d73396609ae2f2b6c31259ade43078c), [`4cb7798`](https://github.com/mastra-ai/mastra/commit/4cb77987b5aeeb94b3dc955ae8ee0c2c227f8cfe), [`caf94f9`](https://github.com/mastra-ai/mastra/commit/caf94f9c1927f737370b6118264bd16c7210a765), [`6c9f7ab`](https://github.com/mastra-ai/mastra/commit/6c9f7abf9bdce0a52450398b31d497519465bb80), [`91196d5`](https://github.com/mastra-ai/mastra/commit/91196d5a6d582c0f494622d0378f33e22d881659), [`f36019c`](https://github.com/mastra-ai/mastra/commit/f36019c24193e0d29f920663851198bf45e3d12f)]:
  - @mastra/core@1.72.0-alpha.10
  - @mastra/libsql@1.24.0-alpha.3

## 1.9.0-alpha.9

### Patch Changes

- Updated dependencies [[`5197f81`](https://github.com/mastra-ai/mastra/commit/5197f81d6a5641f80f0ee6596ac085653b38cca3), [`93fe2d6`](https://github.com/mastra-ai/mastra/commit/93fe2d6a9e47861d90cc0fd0080aefdb8cabb612), [`561e2a6`](https://github.com/mastra-ai/mastra/commit/561e2a6c8a44dbfd91eae390e14671462497cf85), [`8156816`](https://github.com/mastra-ai/mastra/commit/815681621dd88997608c5b7e8f0f87fe03cd1d18), [`94ba70e`](https://github.com/mastra-ai/mastra/commit/94ba70ea6ba8a53f5e4010392bf3bbaecde7966d), [`5197f81`](https://github.com/mastra-ai/mastra/commit/5197f81d6a5641f80f0ee6596ac085653b38cca3), [`a7895fc`](https://github.com/mastra-ai/mastra/commit/a7895fce693e499c08c4784c57d4c4f46c0e1ccb), [`5197f81`](https://github.com/mastra-ai/mastra/commit/5197f81d6a5641f80f0ee6596ac085653b38cca3), [`0c2fe6c`](https://github.com/mastra-ai/mastra/commit/0c2fe6c00909795234270c8ea2c2c53882d63798), [`dd01709`](https://github.com/mastra-ai/mastra/commit/dd01709f780562f9ff8c72d977f3da5ae265970e)]:
  - @mastra/duckdb@1.12.0-alpha.2
  - @mastra/core@1.72.0-alpha.9
  - @mastra/pg@1.28.0-alpha.4

## 1.9.0-alpha.8

### Patch Changes

- Updated dependencies [[`4d187b7`](https://github.com/mastra-ai/mastra/commit/4d187b79d7ecce4d2f357f5fe385b414a532ff19), [`2a28888`](https://github.com/mastra-ai/mastra/commit/2a28888f7dfee74f84ec548c9c222cfd1aa7f393)]:
  - @mastra/core@1.72.0-alpha.8

## 1.9.0-alpha.7

### Minor Changes

- Added model, mode, and reasoning selection for Agent Client Protocol clients: ([#24321](https://github.com/mastra-ai/mastra/pull/24321))

  ```ts
  await connection.setSessionConfigOption({
    sessionId,
    configId: 'thought_level',
    value: 'high',
  });
  ```

  Fixed user prompts and internal system messages appearing as assistant replies. Failed turns now return errors that clients can display; token limits and refusals return their corresponding protocol stop reasons.

  Each conversation now has its own runtime and uses the client's requested working directory. Client-supplied stdio and HTTP MCP servers connect with their configured environment variables or headers. Unsupported legacy SSE servers return an error before session startup.

  Tool approvals and sandbox access requests now ask the client for permission. Cancelling a session stops its active turn and queued prompts without interrupting other conversations. Shutdown waits for cleanup even when multiple signals arrive.

  Headless runs report session cancellation during startup as aborted while preserving provider and transport errors. Session creation retains its original error even if cleanup also fails.

  Model lists now omit unconfigured providers and retain full routing IDs in labels, preventing gateway entries from appearing to be direct provider models.

  Added workspace skill discovery and invocation for Agent Client Protocol clients. Clients can list user-invokable skills and activate them with an ordinary prompt:

  ```ts
  await connection.prompt({
    sessionId,
    prompt: [{ type: 'text', text: '/skill/review Check the current changes' }],
  });
  ```

  Skills marked `user-invocable: false` are hidden and cannot be invoked through slash commands.

### Patch Changes

- **Approval prompts are now independent per thread and run.** Concurrent and detached approvals stop overwriting, stranding, or answering each other's gates: gates are keyed by tool call and tagged with the thread and run that opened them, abort and user-message interjection release only the current thread's gates, detached-thread approvals no longer fire notifications or permission hooks, and an approved run resumes against the thread, run, resource, agent, and cancellation signal that actually parked it — so a mode switch, resource re-scope, or a successor run cannot redirect or cancel the parked continuation. ([#24776](https://github.com/mastra-ai/mastra/pull/24776))

  **Approval responses now require the gate's `toolCallId`.** Without the id, a response could release whichever gate happened to be parked — another thread's or another run's — so an id-less response is rejected instead of silently applied. Every caller inside the repo already passes the id; this only affects external callers of the session API.

  Before:

  ```ts
  session.respondToToolApproval({ decision: 'approve' });
  ```

  After:

  ```ts
  session.respondToToolApproval({ decision: 'approve', toolCallId });
  ```

  Similarly, `SessionApproval.arm()` now requires a `toolCallId`, and `getToolCallId()` is replaced by `getToolCallIds()` (which accepts an optional thread/run filter).

  **"Always allow" grants are now scoped to the gate's thread.** Approving with `always_allow_category` grants the tool's category to the thread that owns the gate rather than the whole session, so a background thread's approval cannot widen what the current thread may run without prompting. `grantCategory`, `grantTool`, `hasCategoryGrant`, `hasToolGrant`, and `getGrants` accept an optional `threadId`; passing one scopes the grant to that thread, omitting it keeps the existing session-wide behavior for embedders that grant explicitly.

- Updated dependencies [[`9ce3444`](https://github.com/mastra-ai/mastra/commit/9ce3444d1a6b17e72b0a20c74603abaf252a843e), [`3b77788`](https://github.com/mastra-ai/mastra/commit/3b77788a08df1e754282d39c42823e6e1c5f2742), [`987257a`](https://github.com/mastra-ai/mastra/commit/987257a34cda8a153fe592c31d75fbb1dee55202), [`65a93a2`](https://github.com/mastra-ai/mastra/commit/65a93a2a3b1434d605a6a417cb83d2d58e16bfc0), [`fd92729`](https://github.com/mastra-ai/mastra/commit/fd92729380a29f2a0ec822e39f3c09eb9aaa5ac5), [`79c3b1f`](https://github.com/mastra-ai/mastra/commit/79c3b1fa4d470585a00558b317ed47db9b1decd4), [`4092ef2`](https://github.com/mastra-ai/mastra/commit/4092ef29aad09f2ba5f90c92a4d4d3bd444eae67), [`68e8258`](https://github.com/mastra-ai/mastra/commit/68e8258560d09abdf8595488aff866f6e39c7913), [`e62e372`](https://github.com/mastra-ai/mastra/commit/e62e3721356955f0a9fd3d723cee9fa0c160652b), [`13f03a4`](https://github.com/mastra-ai/mastra/commit/13f03a4e969384ccb63b81759a9e89a026b1fed8), [`0eb178e`](https://github.com/mastra-ai/mastra/commit/0eb178e3e06fd90d1f76faea8dbbaba8f97afa1f), [`5026973`](https://github.com/mastra-ai/mastra/commit/50269736f432cee1170627b2b6f88ba1431e837f), [`0eb178e`](https://github.com/mastra-ai/mastra/commit/0eb178e3e06fd90d1f76faea8dbbaba8f97afa1f)]:
  - @mastra/core@1.72.0-alpha.7
  - @mastra/observability@1.18.2-alpha.1
  - @mastra/mcp@2.1.1-alpha.0
  - @mastra/memory@1.33.0-alpha.4
  - @mastra/libsql@1.24.0-alpha.2
  - @mastra/pg@1.28.0-alpha.3

## 1.8.4-alpha.6

### Patch Changes

- Updated dependencies [[`1818674`](https://github.com/mastra-ai/mastra/commit/18186744bebffdfecdca33e0b8b6a421cc95ed0d)]:
  - @mastra/duckdb@1.11.2-alpha.1
  - @mastra/core@1.72.0-alpha.6

## 1.8.4-alpha.5

### Patch Changes

- Updated dependencies [[`43fbe75`](https://github.com/mastra-ai/mastra/commit/43fbe75535650345cf61dee00cf3e7b3f5efaf7f), [`ebd03fd`](https://github.com/mastra-ai/mastra/commit/ebd03fd3bc93fe3930747956724252f7c8834826), [`b18d177`](https://github.com/mastra-ai/mastra/commit/b18d1776860af6bf5a4fcb1784ae952024fea87a), [`2c57ba8`](https://github.com/mastra-ai/mastra/commit/2c57ba896b04215fface2a8216b88fe59cfdd041), [`f6effda`](https://github.com/mastra-ai/mastra/commit/f6effdabafa9fc6388478b3e281ad4c457d4200b), [`7f4ce21`](https://github.com/mastra-ai/mastra/commit/7f4ce2190029710851d95f7b75a2fb724782483c), [`3f50f2a`](https://github.com/mastra-ai/mastra/commit/3f50f2a59068fc91ef7ccc513e5d93845faa298e), [`1ba1588`](https://github.com/mastra-ai/mastra/commit/1ba158873dadf3d290b111981c3bc7ef95ab1d1c), [`b537ab1`](https://github.com/mastra-ai/mastra/commit/b537ab14714870e058775530bc55b37c9115613f), [`d4e350a`](https://github.com/mastra-ai/mastra/commit/d4e350a5c1e29a7da5a22da52ed1f33431403012)]:
  - @mastra/core@1.72.0-alpha.5
  - @mastra/duckdb@1.11.2-alpha.0
  - @mastra/schema-compat@1.3.12-alpha.1
  - @mastra/mcp@2.1.0
  - @mastra/memory@1.33.0-alpha.3

## 1.8.4-alpha.4

### Patch Changes

- Updated dependencies [[`9773cb2`](https://github.com/mastra-ai/mastra/commit/9773cb2f22f307c8017f887af4a6728c4cb875c9)]:
  - @mastra/core@1.72.0-alpha.4

## 1.8.4-alpha.3

### Patch Changes

- Mastra Code now retries once when OpenAI or Anthropic cybersecurity safeguards refuse ordinary coding work partway through a run, instead of stopping the run with a refusal error. ([#25172](https://github.com/mastra-ai/mastra/pull/25172))

  The behavior needs no configuration:

  ```ts
  import { mountAgentControllerOnMastra } from '@mastra/code-sdk';

  const { mastra, controller } = await mountAgentControllerOnMastra({ cwd: process.cwd() });
  ```

- Updated dependencies [[`afc53be`](https://github.com/mastra-ai/mastra/commit/afc53be4c95e83e8613f4e080b5a1926e63c5da6), [`77c6f1c`](https://github.com/mastra-ai/mastra/commit/77c6f1cf14ba9ba47257829646a4569c4462d12f), [`3d25340`](https://github.com/mastra-ai/mastra/commit/3d2534080417711d1baf2ad947d1205ca95a34cd), [`afc53be`](https://github.com/mastra-ai/mastra/commit/afc53be4c95e83e8613f4e080b5a1926e63c5da6), [`b33985e`](https://github.com/mastra-ai/mastra/commit/b33985eac3e019f58d3785c48ef85eae48b4e068), [`fbe37b7`](https://github.com/mastra-ai/mastra/commit/fbe37b7524f467a0bc43c55fb0662cb5e5cc3e16), [`32d71df`](https://github.com/mastra-ai/mastra/commit/32d71df2ce71573b40f9a62b8ac510ad6eadd859), [`0391c26`](https://github.com/mastra-ai/mastra/commit/0391c265110641e148371442460ec4356b8b1667), [`444debd`](https://github.com/mastra-ai/mastra/commit/444debd7104ada74fa15d0e70703ee9be180fc75), [`9997948`](https://github.com/mastra-ai/mastra/commit/99979482956903a2cd685b31f53370dd33074799), [`77c6f1c`](https://github.com/mastra-ai/mastra/commit/77c6f1cf14ba9ba47257829646a4569c4462d12f), [`7540eb1`](https://github.com/mastra-ai/mastra/commit/7540eb176c32ffbff45ccc64a8d8fce82ce42a94), [`14c54a9`](https://github.com/mastra-ai/mastra/commit/14c54a99d40a60d55fe9f12698824339c81500a8), [`9623397`](https://github.com/mastra-ai/mastra/commit/96233975b75135852c9b1616b91fd8cb54c77a53)]:
  - @mastra/libsql@1.24.0-alpha.1
  - @mastra/pg@1.28.0-alpha.2
  - @mastra/core@1.72.0-alpha.3
  - @mastra/memory@1.33.0-alpha.2

## 1.8.4-alpha.2

### Patch Changes

- Updated dependencies [[`68cc668`](https://github.com/mastra-ai/mastra/commit/68cc66800e5ce6f5d62189fc7b5ef9d71cf80971), [`781762b`](https://github.com/mastra-ai/mastra/commit/781762b2dcd0c8cc7f9b8ab73824ec45a5225db7), [`cc0da13`](https://github.com/mastra-ai/mastra/commit/cc0da13b826d5f74213c4d8c470acf8698542249), [`f2c3f8c`](https://github.com/mastra-ai/mastra/commit/f2c3f8c74e1d7bc7baca5303b36320b0b361775c), [`cc0da13`](https://github.com/mastra-ai/mastra/commit/cc0da13b826d5f74213c4d8c470acf8698542249), [`1fe1c2b`](https://github.com/mastra-ai/mastra/commit/1fe1c2b6f0b29481dca62a9199af751d594e3ea6), [`279a736`](https://github.com/mastra-ai/mastra/commit/279a736c62495cac0f247ab1402a8c80bccc892a), [`cc0da13`](https://github.com/mastra-ai/mastra/commit/cc0da13b826d5f74213c4d8c470acf8698542249), [`4edc93d`](https://github.com/mastra-ai/mastra/commit/4edc93dedadb89686aad75a4853cb0aa807d256e)]:
  - @mastra/core@1.72.0-alpha.2
  - @mastra/pg@1.27.2-alpha.1
  - @mastra/libsql@1.23.4-alpha.0

## 1.8.4-alpha.1

### Patch Changes

- Fixed GitHub plugin installs failing when `package.json` declares pnpm with a Corepack integrity hash, such as `"packageManager": "pnpm@12.6.0+sha512.<hash>"` (the format written by `corepack use`). The hash is now accepted and passed to Corepack, which verifies the downloaded pnpm against it. ([#25121](https://github.com/mastra-ai/mastra/pull/25121))

- Quiet mode now shows a short description of each shell command, like `Drilling into the failed CI job`, instead of the raw command, so you can follow what the agent is doing without reading long commands and scripts. The agent is asked to write the description first and to phrase descriptions as a running narrative across commands. The description streams in as the agent writes it, and the raw command never flashes first. ([#25032](https://github.com/mastra-ai/mastra/pull/25032))

  Consecutive shell calls in the same directory share one compact box. When the quiet mode tool preview lines setting is 1 or more, the latest output streams into a shared preview at the top of the box:

  ```
  ╭──────────────────────────────────────────────────────────╮
  │  Test Files  3 passed (3)                                │
  │       Tests  42 passed (42)                              │
  ├──────────────────────────────────────────────────────────┤
  │ $ ~/code/my-project                                      │
  ├──────────────────────────────────────────────────────────┤
  │ ✓ Listing later commits touching the sandbox code  101ms │
  │ ✗ Checking the release tag                          1.5s │
  │   └▸ fatal: ambiguous argument 'v1.68.0..HEAD'           │
  │ ⠋ Running the sandbox test suite                      4s │
  ╰──────────────────────────────────────────────────────────╯
  ```

  Each directory gets its own box (subdirectories of the project show as `./path`), running commands show a spinner and a live timer, failed commands show their error line, and background commands are marked as started. With preview lines set to None, the box has no preview. Ctrl+E still reveals the full command and output.

- Fixed agents receiving the host app's `AGENTS.md` when working in a different repository (for example, Mastra Factory runs). Instruction-file reminders now resolve relative paths against the session's project path and only load instruction files from inside that checkout. ([#25071](https://github.com/mastra-ai/mastra/pull/25071))

- Updated dependencies [[`af4aed5`](https://github.com/mastra-ai/mastra/commit/af4aed50ad96b340d82a67c3f01cbf358b156ab2), [`4601dfa`](https://github.com/mastra-ai/mastra/commit/4601dfac7c2bfdf04f041b1725c8ac4ae92a8d7d), [`63927e8`](https://github.com/mastra-ai/mastra/commit/63927e89c1b9db0fc87eef8503e3a03204f24b09), [`ec005d5`](https://github.com/mastra-ai/mastra/commit/ec005d517ea10b7742e67f7e75bf89259d72c37e), [`3913a33`](https://github.com/mastra-ai/mastra/commit/3913a33fd5b13dc226b1ed6253c9357cb392dd04), [`08a0aea`](https://github.com/mastra-ai/mastra/commit/08a0aea2f2af12276e333c62aaf368a9240ff68f), [`56fef1c`](https://github.com/mastra-ai/mastra/commit/56fef1cdd92a671c3de2cc5e4a319c637f700cf4), [`4d40bd9`](https://github.com/mastra-ai/mastra/commit/4d40bd91ccb00db163365a319b5d82bfb56a9ace), [`d2f0cd7`](https://github.com/mastra-ai/mastra/commit/d2f0cd7c5d5f5f06cf5b65cf78a9f14ac052dbb1), [`c01f1ad`](https://github.com/mastra-ai/mastra/commit/c01f1ad358db0ab361fdb1b2f4f77c88540c2671), [`676fcbf`](https://github.com/mastra-ai/mastra/commit/676fcbfc5f770ee45560c7b558b17ad5ff25d9e7)]:
  - @mastra/core@1.72.0-alpha.1
  - @mastra/observability@1.18.2-alpha.0
  - @mastra/schema-compat@1.3.12-alpha.0
  - @mastra/mcp@2.1.0
  - @mastra/memory@1.32.2-alpha.1

## 1.8.4-alpha.0

### Patch Changes

- Fixed cross-agent thread ownership so peers advertise the mastracode instance that currently owns the thread instead of an instance that only visited it earlier. ([#24898](https://github.com/mastra-ai/mastra/pull/24898))

  Sessions still keep every loaded thread advertised so saved peers remain reachable after `/new`. When another instance requests a thread that is no longer current, the SDK now transfers its lease during that claim attempt and forgets the yielded advertisement. A thread that is still current is retained, and retries succeed as soon as its current owner moves away. This prevents stale titles, missing peers, timeout races during event-loop stalls, and release-before-reclaim gaps.

- Updated dependencies [[`e1c3193`](https://github.com/mastra-ai/mastra/commit/e1c3193b18ca68e5cca27f7dce9b0381a6e7b95d), [`4375206`](https://github.com/mastra-ai/mastra/commit/4375206131ff701405a20326be660b2e8c3742f8), [`6946c4d`](https://github.com/mastra-ai/mastra/commit/6946c4db91071cb43fb36514a42a1e4ce05c37ba), [`5e799d9`](https://github.com/mastra-ai/mastra/commit/5e799d9098c5c4d1078bf90647e95db699be11ea), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0c23429`](https://github.com/mastra-ai/mastra/commit/0c23429515b5c307e8a5759f5be1ce20d09d2347), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`4b5b212`](https://github.com/mastra-ai/mastra/commit/4b5b212f1c5caa40a2d02308806bbe610f194503), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`d3a7dba`](https://github.com/mastra-ai/mastra/commit/d3a7dbaeb0d027e1e47e4e4ddb2ede271a007e17), [`64916c6`](https://github.com/mastra-ai/mastra/commit/64916c66e8d9dec107da2f81e7c1301471bf7bc3), [`be9d1aa`](https://github.com/mastra-ai/mastra/commit/be9d1aa2c35acb6888d5fa69126f0f8e9a09bb47), [`64916c6`](https://github.com/mastra-ai/mastra/commit/64916c66e8d9dec107da2f81e7c1301471bf7bc3), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`5e799d9`](https://github.com/mastra-ai/mastra/commit/5e799d9098c5c4d1078bf90647e95db699be11ea), [`6946c4d`](https://github.com/mastra-ai/mastra/commit/6946c4db91071cb43fb36514a42a1e4ce05c37ba), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`4b5b212`](https://github.com/mastra-ai/mastra/commit/4b5b212f1c5caa40a2d02308806bbe610f194503), [`5036e61`](https://github.com/mastra-ai/mastra/commit/5036e6179bee4105ad8f1fc57d315f78024565f4), [`4375206`](https://github.com/mastra-ai/mastra/commit/4375206131ff701405a20326be660b2e8c3742f8), [`d9790fd`](https://github.com/mastra-ai/mastra/commit/d9790fd00d95063de288560f6a0d2bac8f57cc4d), [`4375206`](https://github.com/mastra-ai/mastra/commit/4375206131ff701405a20326be660b2e8c3742f8), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`5e799d9`](https://github.com/mastra-ai/mastra/commit/5e799d9098c5c4d1078bf90647e95db699be11ea), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11), [`0be9960`](https://github.com/mastra-ai/mastra/commit/0be9960226ee1734e7ea0baecb5d13035f980b11)]:
  - @mastra/core@1.72.0-alpha.0
  - @mastra/memory@1.32.2-alpha.0
  - @mastra/pg@1.27.2-alpha.0

## 1.8.3

### Patch Changes

- **Stagehand model selection now follows your chat setup instead of a hardcoded fallback.** ([#25028](https://github.com/mastra-ai/mastra/pull/25028))

  - Added `resolveStagehandModel()` to report which model Stagehand will use and why. It resolves, in order: `browser.stagehand.model` (`settings`), the chat model captured at browser launch when Stagehand can route it (`chat-model`), the OpenAI Codex default model when you are signed in with Codex (`codex-oauth`), then Stagehand's own default (`stagehand-default`).
  - Any `openai/*` model, configured or inferred, now goes through the Codex endpoint when your OpenAI login is Codex OAuth, with the same `-codex` model-id remaps the chat agents apply. Codex-only users no longer need a separate `OPENAI_API_KEY` for browser automation.
  - Dotted Anthropic ids such as `anthropic/claude-opus-4.6` are normalized before being handed to Stagehand, matching the chat agents.
  - Fixed the Browserbase API key being saved in session state; the active-browser snapshot is now credential-free and records which model the browser launched with.

  ```ts
  import { resolveStagehandModel } from '@mastra/code-sdk/onboarding/settings';

  const { modelName, source, viaCodexOAuth } = resolveStagehandModel(settings.browser, {
    chatModelId: session.model.get(),
  });
  // e.g. { modelName: 'anthropic/claude-sonnet-4-5', source: 'chat-model', viaCodexOAuth: false }
  ```

- Updated dependencies [[`fc7d2c1`](https://github.com/mastra-ai/mastra/commit/fc7d2c102e911f43f70f425e67c970231ea19363), [`4607046`](https://github.com/mastra-ai/mastra/commit/460704663e2869183e7dfff7efec49a4f2f47503), [`b7f9616`](https://github.com/mastra-ai/mastra/commit/b7f9616e443113c72de697900c7f9dc357e1d11c), [`1e435dc`](https://github.com/mastra-ai/mastra/commit/1e435dc84a9c1b35aa58d0ab9b14ff39fe13aab0), [`9ba23a2`](https://github.com/mastra-ai/mastra/commit/9ba23a23893622b72c76189199d02432590606c1), [`b7f9616`](https://github.com/mastra-ai/mastra/commit/b7f9616e443113c72de697900c7f9dc357e1d11c), [`527e1d8`](https://github.com/mastra-ai/mastra/commit/527e1d8e705de7002f9fa2222b08baf3bbaf4267), [`b410849`](https://github.com/mastra-ai/mastra/commit/b4108495c7a60343b83b82ae80d6ca9b75305fbf), [`b757896`](https://github.com/mastra-ai/mastra/commit/b757896872edd74f71ec104be92273c5406265da), [`9ba23a2`](https://github.com/mastra-ai/mastra/commit/9ba23a23893622b72c76189199d02432590606c1), [`0a1f74a`](https://github.com/mastra-ai/mastra/commit/0a1f74a94e3d7944640978c9334b7a6e6f97b886), [`867df31`](https://github.com/mastra-ai/mastra/commit/867df31d35fdf9dcf1a02b3563af7c6f76b6b166), [`7f64865`](https://github.com/mastra-ai/mastra/commit/7f648656d2b24b214a899e8835b8286333c80a19), [`f751e65`](https://github.com/mastra-ai/mastra/commit/f751e659f496e5e53ed38632c59c296fec2ccbe5), [`fec55ac`](https://github.com/mastra-ai/mastra/commit/fec55acdb25540a3b7c2434451db0234063f8a1e), [`4607046`](https://github.com/mastra-ai/mastra/commit/460704663e2869183e7dfff7efec49a4f2f47503)]:
  - @mastra/core@1.71.0
  - @mastra/duckdb@1.11.1
  - @mastra/observability@1.18.1
  - @mastra/fastembed@1.3.2
  - @mastra/libsql@1.23.3
  - @mastra/pg@1.27.1
  - @mastra/memory@1.32.1
  - @mastra/mcp@2.1.0

## 1.8.3-alpha.1

### Patch Changes

- **Stagehand model selection now follows your chat setup instead of a hardcoded fallback.** ([#25028](https://github.com/mastra-ai/mastra/pull/25028))

  - Added `resolveStagehandModel()` to report which model Stagehand will use and why. It resolves, in order: `browser.stagehand.model` (`settings`), the chat model captured at browser launch when Stagehand can route it (`chat-model`), the OpenAI Codex default model when you are signed in with Codex (`codex-oauth`), then Stagehand's own default (`stagehand-default`).
  - Any `openai/*` model, configured or inferred, now goes through the Codex endpoint when your OpenAI login is Codex OAuth, with the same `-codex` model-id remaps the chat agents apply. Codex-only users no longer need a separate `OPENAI_API_KEY` for browser automation.
  - Dotted Anthropic ids such as `anthropic/claude-opus-4.6` are normalized before being handed to Stagehand, matching the chat agents.
  - Fixed the Browserbase API key being saved in session state; the active-browser snapshot is now credential-free and records which model the browser launched with.

  ```ts
  import { resolveStagehandModel } from '@mastra/code-sdk/onboarding/settings';

  const { modelName, source, viaCodexOAuth } = resolveStagehandModel(settings.browser, {
    chatModelId: session.model.get(),
  });
  // e.g. { modelName: 'anthropic/claude-sonnet-4-5', source: 'chat-model', viaCodexOAuth: false }
  ```

- Updated dependencies [[`fc7d2c1`](https://github.com/mastra-ai/mastra/commit/fc7d2c102e911f43f70f425e67c970231ea19363), [`4607046`](https://github.com/mastra-ai/mastra/commit/460704663e2869183e7dfff7efec49a4f2f47503), [`b7f9616`](https://github.com/mastra-ai/mastra/commit/b7f9616e443113c72de697900c7f9dc357e1d11c), [`1e435dc`](https://github.com/mastra-ai/mastra/commit/1e435dc84a9c1b35aa58d0ab9b14ff39fe13aab0), [`9ba23a2`](https://github.com/mastra-ai/mastra/commit/9ba23a23893622b72c76189199d02432590606c1), [`b7f9616`](https://github.com/mastra-ai/mastra/commit/b7f9616e443113c72de697900c7f9dc357e1d11c), [`527e1d8`](https://github.com/mastra-ai/mastra/commit/527e1d8e705de7002f9fa2222b08baf3bbaf4267), [`b410849`](https://github.com/mastra-ai/mastra/commit/b4108495c7a60343b83b82ae80d6ca9b75305fbf), [`9ba23a2`](https://github.com/mastra-ai/mastra/commit/9ba23a23893622b72c76189199d02432590606c1), [`867df31`](https://github.com/mastra-ai/mastra/commit/867df31d35fdf9dcf1a02b3563af7c6f76b6b166), [`4607046`](https://github.com/mastra-ai/mastra/commit/460704663e2869183e7dfff7efec49a4f2f47503)]:
  - @mastra/core@1.71.0-alpha.1
  - @mastra/duckdb@1.11.1-alpha.1
  - @mastra/observability@1.18.1-alpha.0
  - @mastra/fastembed@1.3.2-alpha.0
  - @mastra/libsql@1.23.3-alpha.0
  - @mastra/pg@1.27.1-alpha.0
  - @mastra/memory@1.32.1-alpha.0
  - @mastra/mcp@2.1.0

## 1.8.3-alpha.0

### Patch Changes

- Updated dependencies [[`b757896`](https://github.com/mastra-ai/mastra/commit/b757896872edd74f71ec104be92273c5406265da), [`f751e65`](https://github.com/mastra-ai/mastra/commit/f751e659f496e5e53ed38632c59c296fec2ccbe5), [`fec55ac`](https://github.com/mastra-ai/mastra/commit/fec55acdb25540a3b7c2434451db0234063f8a1e)]:
  - @mastra/core@1.71.0-alpha.0
  - @mastra/duckdb@1.11.1-alpha.0

## 1.8.2

### Patch Changes

- Added a `prepareWakeRequestContext` option to `createMastraCode()`. A wake (a notification or cross-agent signal that starts a run on an idle thread) has no inbound request, so hosts that resolve credentials per tenant can use this option to attach the owning identity before the run starts. It is called only when a session owns the target resource. ([#24909](https://github.com/mastra-ai/mastra/pull/24909))

  ```ts
  const mastraCode = await createMastraCode({
    prepareWakeRequestContext: async ({ requestContext, resourceId }) => {
      const owner = await lookUpOwner(resourceId);
      if (owner) requestContext.set('user', owner);
    },
  });
  ```

- Fixed `agent_signal_send` so senders put content where the peer can see it. The `payload` parameter was removed because peers never received it, and the `summary` parameter was renamed to `message` to make clear it is the full message delivered to the peer. ([#24823](https://github.com/mastra-ai/mastra/pull/24823))

  **Before:**

  ```ts
  agent_signal_send({
    targetId: 'peer-id',
    summary: 'Review this',
    expectsReply: false,
  });
  ```

  **After:**

  ```ts
  agent_signal_send({
    targetId: 'peer-id',
    message: 'Review this',
    expectsReply: false,
  });
  ```

  The tool result now reports only the routing outcome instead of echoing the whole message back to the sender. Mastra Code still shows the target, routing options, full message, and outcome in the standard tool display, with a truncated message preview in quiet mode.

- Fixed plugin updates occasionally keeping stale code loaded. When an updated plugin file had the same size and modification timestamp as the previous version, the reload could reuse the old module; plugin reloads now detect changes by file content, so an update always runs the new code. ([#24890](https://github.com/mastra-ai/mastra/pull/24890))

- The `/think` thinking level now applies to Gemini, custom OpenAI-compatible providers, and OpenAI API-key models, not just Anthropic and OpenAI Codex. Previously these models silently ignored it. ([#24899](https://github.com/mastra-ai/mastra/pull/24899))

  ```
  /think high
  ```

  Gemini and OpenAI API-key models map the level to what each model supports. Custom OpenAI-compatible providers receive the selected level unchanged, including `xhigh` and `max`. With thinking `off` (the default), requests are unchanged.

- Updated dependencies [[`bfde500`](https://github.com/mastra-ai/mastra/commit/bfde5009d1d9bdbce241132b3df9e638ad805fab), [`2d73b0f`](https://github.com/mastra-ai/mastra/commit/2d73b0f52801be76691bab1204f133de1d631208), [`04233fd`](https://github.com/mastra-ai/mastra/commit/04233fdc197e1d9a4b13e9d182447df283ea1850), [`574a55c`](https://github.com/mastra-ai/mastra/commit/574a55cd26cc2171f61906e0f090c817032c9603), [`e33a488`](https://github.com/mastra-ai/mastra/commit/e33a488ec308b7742e2bf66528873767f802c957), [`ac426a0`](https://github.com/mastra-ai/mastra/commit/ac426a0f015e0d234f1394505c0b0795dc03ebed), [`fc0ee2b`](https://github.com/mastra-ai/mastra/commit/fc0ee2b7d6d33bd5dd80f7338a5a90ec615b1235), [`4831f68`](https://github.com/mastra-ai/mastra/commit/4831f68d626bc8aac7e4f1cc6adc97ae3147f90b), [`9544a15`](https://github.com/mastra-ai/mastra/commit/9544a158e9bf110b3873b74b2c368616015244ee), [`22ed0d9`](https://github.com/mastra-ai/mastra/commit/22ed0d9f0f399ca29cf66e847795784018e6b79c), [`22ed0d9`](https://github.com/mastra-ai/mastra/commit/22ed0d9f0f399ca29cf66e847795784018e6b79c), [`4d8d9ad`](https://github.com/mastra-ai/mastra/commit/4d8d9adaf8bbe46ed5c398d1ce39b120801c9ed0), [`2d73b0f`](https://github.com/mastra-ai/mastra/commit/2d73b0f52801be76691bab1204f133de1d631208), [`68fece5`](https://github.com/mastra-ai/mastra/commit/68fece5b724be17ab9bbfaa132468c5afa866b39), [`e7d378f`](https://github.com/mastra-ai/mastra/commit/e7d378f16e68b9ec1268a71960ecf102f86cd437), [`8adceb5`](https://github.com/mastra-ai/mastra/commit/8adceb53a48bb1b628ba839665e736b062b0d58f), [`e675e83`](https://github.com/mastra-ai/mastra/commit/e675e83c29d1c69ee334985725c5ce78ac5dcd6f), [`f9ffd28`](https://github.com/mastra-ai/mastra/commit/f9ffd2825c3cb21145b361f06c96f3c35c07bce2), [`ac426a0`](https://github.com/mastra-ai/mastra/commit/ac426a0f015e0d234f1394505c0b0795dc03ebed), [`5e4edbe`](https://github.com/mastra-ai/mastra/commit/5e4edbe212a714cc659203964f60e44988c7171f), [`7465c16`](https://github.com/mastra-ai/mastra/commit/7465c166894c5a0628634f564c62a26322654f9e), [`9f349e3`](https://github.com/mastra-ai/mastra/commit/9f349e34a1bc6e1011c471ad305068d95966ae35), [`c593409`](https://github.com/mastra-ai/mastra/commit/c59340998206b7273747d5b5281a09ab26535f81), [`4cb2f12`](https://github.com/mastra-ai/mastra/commit/4cb2f12d05b0de71a22127a76a16c1732bb674ec), [`22ed0d9`](https://github.com/mastra-ai/mastra/commit/22ed0d9f0f399ca29cf66e847795784018e6b79c), [`8ac7c6f`](https://github.com/mastra-ai/mastra/commit/8ac7c6f57852227279622836cbf8afaa7b41a475), [`3601e57`](https://github.com/mastra-ai/mastra/commit/3601e57cd8a4d2ca6f68d460c527c472a19f612d), [`ac426a0`](https://github.com/mastra-ai/mastra/commit/ac426a0f015e0d234f1394505c0b0795dc03ebed), [`ac426a0`](https://github.com/mastra-ai/mastra/commit/ac426a0f015e0d234f1394505c0b0795dc03ebed), [`cf98812`](https://github.com/mastra-ai/mastra/commit/cf98812b7e9b511bc45a8641047ad7b91fee6abf), [`cf98812`](https://github.com/mastra-ai/mastra/commit/cf98812b7e9b511bc45a8641047ad7b91fee6abf), [`68695fd`](https://github.com/mastra-ai/mastra/commit/68695fdc4b92cdf67c7fcf36603fa3c59e1bc10e), [`68695fd`](https://github.com/mastra-ai/mastra/commit/68695fdc4b92cdf67c7fcf36603fa3c59e1bc10e), [`68695fd`](https://github.com/mastra-ai/mastra/commit/68695fdc4b92cdf67c7fcf36603fa3c59e1bc10e), [`c35feed`](https://github.com/mastra-ai/mastra/commit/c35feedf99a55ad404657a1cebf0c298f36ab82e), [`2d73b0f`](https://github.com/mastra-ai/mastra/commit/2d73b0f52801be76691bab1204f133de1d631208), [`9a2db9a`](https://github.com/mastra-ai/mastra/commit/9a2db9ac12c7b5e24a44841d47a7f7ff17d3f504), [`ff6487e`](https://github.com/mastra-ai/mastra/commit/ff6487e163c4e4fcde950352e6598961b037dd1a)]:
  - @mastra/core@1.70.0
  - @mastra/pg@1.27.0
  - @mastra/memory@1.32.0
  - @mastra/duckdb@1.11.0
  - @mastra/libsql@1.23.2
  - @mastra/mcp@2.1.0

## 1.8.2-alpha.4

### Patch Changes

- Updated dependencies [[`4cb2f12`](https://github.com/mastra-ai/mastra/commit/4cb2f12d05b0de71a22127a76a16c1732bb674ec)]:
  - @mastra/core@1.70.0-alpha.4

## 1.8.2-alpha.3

### Patch Changes

- Updated dependencies [[`04233fd`](https://github.com/mastra-ai/mastra/commit/04233fdc197e1d9a4b13e9d182447df283ea1850), [`e33a488`](https://github.com/mastra-ai/mastra/commit/e33a488ec308b7742e2bf66528873767f802c957), [`9544a15`](https://github.com/mastra-ai/mastra/commit/9544a158e9bf110b3873b74b2c368616015244ee), [`68fece5`](https://github.com/mastra-ai/mastra/commit/68fece5b724be17ab9bbfaa132468c5afa866b39), [`8adceb5`](https://github.com/mastra-ai/mastra/commit/8adceb53a48bb1b628ba839665e736b062b0d58f), [`7465c16`](https://github.com/mastra-ai/mastra/commit/7465c166894c5a0628634f564c62a26322654f9e)]:
  - @mastra/core@1.70.0-alpha.3

## 1.8.2-alpha.2

### Patch Changes

- Added a `prepareWakeRequestContext` option to `createMastraCode()`. A wake (a notification or cross-agent signal that starts a run on an idle thread) has no inbound request, so hosts that resolve credentials per tenant can use this option to attach the owning identity before the run starts. It is called only when a session owns the target resource. ([#24909](https://github.com/mastra-ai/mastra/pull/24909))

  ```ts
  const mastraCode = await createMastraCode({
    prepareWakeRequestContext: async ({ requestContext, resourceId }) => {
      const owner = await lookUpOwner(resourceId);
      if (owner) requestContext.set('user', owner);
    },
  });
  ```

- Fixed `agent_signal_send` so senders put content where the peer can see it. The `payload` parameter was removed because peers never received it, and the `summary` parameter was renamed to `message` to make clear it is the full message delivered to the peer. ([#24823](https://github.com/mastra-ai/mastra/pull/24823))

  **Before:**

  ```ts
  agent_signal_send({
    targetId: 'peer-id',
    summary: 'Review this',
    expectsReply: false,
  });
  ```

  **After:**

  ```ts
  agent_signal_send({
    targetId: 'peer-id',
    message: 'Review this',
    expectsReply: false,
  });
  ```

  The tool result now reports only the routing outcome instead of echoing the whole message back to the sender. Mastra Code still shows the target, routing options, full message, and outcome in the standard tool display, with a truncated message preview in quiet mode.

- Fixed plugin updates occasionally keeping stale code loaded. When an updated plugin file had the same size and modification timestamp as the previous version, the reload could reuse the old module; plugin reloads now detect changes by file content, so an update always runs the new code. ([#24890](https://github.com/mastra-ai/mastra/pull/24890))

- The `/think` thinking level now applies to Gemini, custom OpenAI-compatible providers, and OpenAI API-key models, not just Anthropic and OpenAI Codex. Previously these models silently ignored it. ([#24899](https://github.com/mastra-ai/mastra/pull/24899))

  ```
  /think high
  ```

  Gemini and OpenAI API-key models map the level to what each model supports. Custom OpenAI-compatible providers receive the selected level unchanged, including `xhigh` and `max`. With thinking `off` (the default), requests are unchanged.

- Updated dependencies [[`2d73b0f`](https://github.com/mastra-ai/mastra/commit/2d73b0f52801be76691bab1204f133de1d631208), [`fc0ee2b`](https://github.com/mastra-ai/mastra/commit/fc0ee2b7d6d33bd5dd80f7338a5a90ec615b1235), [`4831f68`](https://github.com/mastra-ai/mastra/commit/4831f68d626bc8aac7e4f1cc6adc97ae3147f90b), [`4d8d9ad`](https://github.com/mastra-ai/mastra/commit/4d8d9adaf8bbe46ed5c398d1ce39b120801c9ed0), [`2d73b0f`](https://github.com/mastra-ai/mastra/commit/2d73b0f52801be76691bab1204f133de1d631208), [`9f349e3`](https://github.com/mastra-ai/mastra/commit/9f349e34a1bc6e1011c471ad305068d95966ae35), [`8ac7c6f`](https://github.com/mastra-ai/mastra/commit/8ac7c6f57852227279622836cbf8afaa7b41a475), [`2d73b0f`](https://github.com/mastra-ai/mastra/commit/2d73b0f52801be76691bab1204f133de1d631208)]:
  - @mastra/pg@1.27.0-alpha.2
  - @mastra/core@1.70.0-alpha.2
  - @mastra/memory@1.32.0-alpha.1
  - @mastra/duckdb@1.11.0-alpha.2

## 1.8.2-alpha.1

### Patch Changes

- Updated dependencies [[`574a55c`](https://github.com/mastra-ai/mastra/commit/574a55cd26cc2171f61906e0f090c817032c9603), [`ac426a0`](https://github.com/mastra-ai/mastra/commit/ac426a0f015e0d234f1394505c0b0795dc03ebed), [`22ed0d9`](https://github.com/mastra-ai/mastra/commit/22ed0d9f0f399ca29cf66e847795784018e6b79c), [`22ed0d9`](https://github.com/mastra-ai/mastra/commit/22ed0d9f0f399ca29cf66e847795784018e6b79c), [`e7d378f`](https://github.com/mastra-ai/mastra/commit/e7d378f16e68b9ec1268a71960ecf102f86cd437), [`e675e83`](https://github.com/mastra-ai/mastra/commit/e675e83c29d1c69ee334985725c5ce78ac5dcd6f), [`ac426a0`](https://github.com/mastra-ai/mastra/commit/ac426a0f015e0d234f1394505c0b0795dc03ebed), [`5e4edbe`](https://github.com/mastra-ai/mastra/commit/5e4edbe212a714cc659203964f60e44988c7171f), [`22ed0d9`](https://github.com/mastra-ai/mastra/commit/22ed0d9f0f399ca29cf66e847795784018e6b79c), [`3601e57`](https://github.com/mastra-ai/mastra/commit/3601e57cd8a4d2ca6f68d460c527c472a19f612d), [`ac426a0`](https://github.com/mastra-ai/mastra/commit/ac426a0f015e0d234f1394505c0b0795dc03ebed), [`ac426a0`](https://github.com/mastra-ai/mastra/commit/ac426a0f015e0d234f1394505c0b0795dc03ebed), [`c35feed`](https://github.com/mastra-ai/mastra/commit/c35feedf99a55ad404657a1cebf0c298f36ab82e), [`9a2db9a`](https://github.com/mastra-ai/mastra/commit/9a2db9ac12c7b5e24a44841d47a7f7ff17d3f504), [`ff6487e`](https://github.com/mastra-ai/mastra/commit/ff6487e163c4e4fcde950352e6598961b037dd1a)]:
  - @mastra/core@1.70.0-alpha.1
  - @mastra/pg@1.27.0-alpha.1
  - @mastra/duckdb@1.11.0-alpha.1
  - @mastra/memory@1.32.0-alpha.0
  - @mastra/libsql@1.23.2-alpha.0

## 1.8.2-alpha.0

### Patch Changes

- Updated dependencies [[`bfde500`](https://github.com/mastra-ai/mastra/commit/bfde5009d1d9bdbce241132b3df9e638ad805fab), [`f9ffd28`](https://github.com/mastra-ai/mastra/commit/f9ffd2825c3cb21145b361f06c96f3c35c07bce2), [`c593409`](https://github.com/mastra-ai/mastra/commit/c59340998206b7273747d5b5281a09ab26535f81), [`cf98812`](https://github.com/mastra-ai/mastra/commit/cf98812b7e9b511bc45a8641047ad7b91fee6abf), [`cf98812`](https://github.com/mastra-ai/mastra/commit/cf98812b7e9b511bc45a8641047ad7b91fee6abf), [`68695fd`](https://github.com/mastra-ai/mastra/commit/68695fdc4b92cdf67c7fcf36603fa3c59e1bc10e), [`68695fd`](https://github.com/mastra-ai/mastra/commit/68695fdc4b92cdf67c7fcf36603fa3c59e1bc10e), [`68695fd`](https://github.com/mastra-ai/mastra/commit/68695fdc4b92cdf67c7fcf36603fa3c59e1bc10e)]:
  - @mastra/core@1.70.0-alpha.0
  - @mastra/mcp@2.1.0-alpha.0
  - @mastra/duckdb@1.11.0-alpha.0
  - @mastra/pg@1.27.0-alpha.0

## 1.8.1

### Patch Changes

- Added configured classifier discovery and typed routing paths to workflow authoring tools. ([#24747](https://github.com/mastra-ai/mastra/pull/24747))

- Missing provider credentials for signed-in Factory accounts now throw `ProviderAuthRequiredError` instead of a plain `Error`, so hosts can classify the failure as an authentication error without matching on the message text. ([#24737](https://github.com/mastra-ai/mastra/pull/24737))

- Fixed hooks running twice for sessions started in your home directory. There, the project hooks file (`~/.mastracode/hooks.json`) is the same file as the global one, and it was loaded as both. It is now loaded once, including when the project directory is a symlink to your home directory. ([#24744](https://github.com/mastra-ai/mastra/pull/24744))

- Fixed plugin tools so background execution is enabled only when the tool declares support; `mastra_expert` is no longer opted in by name. Removed global plugin-call serialization, allowing independently declared tools to run concurrently. ([#24418](https://github.com/mastra-ai/mastra/pull/24418))

- Updated dependencies [[`7fefefd`](https://github.com/mastra-ai/mastra/commit/7fefefdcb91e15f8bf60b5b2148ef27cf1352faf), [`251eb56`](https://github.com/mastra-ai/mastra/commit/251eb5674e8e32855af6925d7fd1cd337aa5ea7d), [`e0fd937`](https://github.com/mastra-ai/mastra/commit/e0fd937e84fa6dd7e82b7b55b039a4191e61aa5c), [`f7180bd`](https://github.com/mastra-ai/mastra/commit/f7180bdd52b4ffaa9f053b8495c6c8b8c530de2a), [`f9ea7b2`](https://github.com/mastra-ai/mastra/commit/f9ea7b2d2f1e925b357fd71fe18ab26d3b00feae), [`fc3ee16`](https://github.com/mastra-ai/mastra/commit/fc3ee1604c0ec0a98e5051585e3d201b5699abbe), [`26ed7ad`](https://github.com/mastra-ai/mastra/commit/26ed7ad111927211231a995346b9b561d4baa8e2), [`ecc642d`](https://github.com/mastra-ai/mastra/commit/ecc642d0a6ca2e938f92129726a4278471924124), [`1ed77dd`](https://github.com/mastra-ai/mastra/commit/1ed77dd7176e2f41ea2bf74f5ab0e4d1899c38e5), [`18863ae`](https://github.com/mastra-ai/mastra/commit/18863ae95c87218b8163e28d9826883cf4edf02b), [`c61d52c`](https://github.com/mastra-ai/mastra/commit/c61d52c338dbd77f3e8f0e7487f44b1f0a0d1350), [`32a9682`](https://github.com/mastra-ai/mastra/commit/32a96824a9ff31c3596fdb1a2789b946eba152cc), [`9ce6bc9`](https://github.com/mastra-ai/mastra/commit/9ce6bc9107b5fe81dffe8a155dded9b0471013b5), [`fc3ee16`](https://github.com/mastra-ai/mastra/commit/fc3ee1604c0ec0a98e5051585e3d201b5699abbe), [`725d46b`](https://github.com/mastra-ai/mastra/commit/725d46b4b7eaf5a3f3ef2f3fbbe8ee8909cb2c9b), [`6e21835`](https://github.com/mastra-ai/mastra/commit/6e2183502250ee5325fc834d80f4d0584916f54e), [`fc3ee16`](https://github.com/mastra-ai/mastra/commit/fc3ee1604c0ec0a98e5051585e3d201b5699abbe), [`70cd0d8`](https://github.com/mastra-ai/mastra/commit/70cd0d80373346b4d04ebf913851ade37aa807ed), [`3802d6f`](https://github.com/mastra-ai/mastra/commit/3802d6f7dbf8c27b1f84b48c6c7c2efa6c4f0d03), [`2a83258`](https://github.com/mastra-ai/mastra/commit/2a832580e3cf3efcdb4be3355eaa9a02929b3a2c), [`fc3ee16`](https://github.com/mastra-ai/mastra/commit/fc3ee1604c0ec0a98e5051585e3d201b5699abbe)]:
  - @mastra/core@1.69.0
  - @mastra/observability@1.18.0
  - @mastra/mcp@2.0.0

## 1.8.1-alpha.4

### Patch Changes

- Added configured classifier discovery and typed routing paths to workflow authoring tools. ([#24747](https://github.com/mastra-ai/mastra/pull/24747))

- Updated dependencies [[`e0fd937`](https://github.com/mastra-ai/mastra/commit/e0fd937e84fa6dd7e82b7b55b039a4191e61aa5c), [`f9ea7b2`](https://github.com/mastra-ai/mastra/commit/f9ea7b2d2f1e925b357fd71fe18ab26d3b00feae), [`fc3ee16`](https://github.com/mastra-ai/mastra/commit/fc3ee1604c0ec0a98e5051585e3d201b5699abbe), [`26ed7ad`](https://github.com/mastra-ai/mastra/commit/26ed7ad111927211231a995346b9b561d4baa8e2), [`ecc642d`](https://github.com/mastra-ai/mastra/commit/ecc642d0a6ca2e938f92129726a4278471924124), [`18863ae`](https://github.com/mastra-ai/mastra/commit/18863ae95c87218b8163e28d9826883cf4edf02b), [`fc3ee16`](https://github.com/mastra-ai/mastra/commit/fc3ee1604c0ec0a98e5051585e3d201b5699abbe), [`725d46b`](https://github.com/mastra-ai/mastra/commit/725d46b4b7eaf5a3f3ef2f3fbbe8ee8909cb2c9b), [`fc3ee16`](https://github.com/mastra-ai/mastra/commit/fc3ee1604c0ec0a98e5051585e3d201b5699abbe), [`3802d6f`](https://github.com/mastra-ai/mastra/commit/3802d6f7dbf8c27b1f84b48c6c7c2efa6c4f0d03), [`fc3ee16`](https://github.com/mastra-ai/mastra/commit/fc3ee1604c0ec0a98e5051585e3d201b5699abbe)]:
  - @mastra/core@1.69.0-alpha.4
  - @mastra/observability@1.18.0-alpha.0
  - @mastra/mcp@2.0.0

## 1.8.1-alpha.3

### Patch Changes

- Fixed hooks running twice for sessions started in your home directory. There, the project hooks file (`~/.mastracode/hooks.json`) is the same file as the global one, and it was loaded as both. It is now loaded once, including when the project directory is a symlink to your home directory. ([#24744](https://github.com/mastra-ai/mastra/pull/24744))

- Fixed plugin tools so background execution is enabled only when the tool declares support; `mastra_expert` is no longer opted in by name. Removed global plugin-call serialization, allowing independently declared tools to run concurrently. ([#24418](https://github.com/mastra-ai/mastra/pull/24418))

- Updated dependencies [[`251eb56`](https://github.com/mastra-ai/mastra/commit/251eb5674e8e32855af6925d7fd1cd337aa5ea7d), [`f7180bd`](https://github.com/mastra-ai/mastra/commit/f7180bdd52b4ffaa9f053b8495c6c8b8c530de2a), [`c61d52c`](https://github.com/mastra-ai/mastra/commit/c61d52c338dbd77f3e8f0e7487f44b1f0a0d1350), [`32a9682`](https://github.com/mastra-ai/mastra/commit/32a96824a9ff31c3596fdb1a2789b946eba152cc), [`9ce6bc9`](https://github.com/mastra-ai/mastra/commit/9ce6bc9107b5fe81dffe8a155dded9b0471013b5), [`2a83258`](https://github.com/mastra-ai/mastra/commit/2a832580e3cf3efcdb4be3355eaa9a02929b3a2c)]:
  - @mastra/core@1.69.0-alpha.3

## 1.8.1-alpha.2

### Patch Changes

- Missing provider credentials for signed-in Factory accounts now throw `ProviderAuthRequiredError` instead of a plain `Error`, so hosts can classify the failure as an authentication error without matching on the message text. ([#24737](https://github.com/mastra-ai/mastra/pull/24737))

- Updated dependencies [[`1ed77dd`](https://github.com/mastra-ai/mastra/commit/1ed77dd7176e2f41ea2bf74f5ab0e4d1899c38e5), [`6e21835`](https://github.com/mastra-ai/mastra/commit/6e2183502250ee5325fc834d80f4d0584916f54e)]:
  - @mastra/core@1.69.0-alpha.2

## 1.8.1-alpha.1

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.69.0-alpha.1

## 1.8.1-alpha.0

### Patch Changes

- Updated dependencies [[`7fefefd`](https://github.com/mastra-ai/mastra/commit/7fefefdcb91e15f8bf60b5b2148ef27cf1352faf), [`70cd0d8`](https://github.com/mastra-ai/mastra/commit/70cd0d80373346b4d04ebf913851ade37aa807ed)]:
  - @mastra/core@1.69.0-alpha.0

## 1.8.0

### Minor Changes

- Added native background tool and delegated subagent support to Mastra Code sessions. ([#19960](https://github.com/mastra-ai/mastra/pull/19960))

  Set `backgroundTools.enabled` to `true` in Mastra Code settings to make read-only workspace tools and the Alexandria expert background-eligible. Eligible tools remain foreground by default, and agents can opt individual calls into `deferred` or `awaited` execution through the Core `_background.disposition` override.

  Mastra Code factory results now expose `backgroundCompletionEvents`, which publishes reconciled `completed`, `failed`, and `cancelled` events for the originating resource and thread:

  ```ts
  const mastraCode = await createMastraCode(options);

  const unsubscribe = mastraCode.backgroundCompletionEvents.subscribe(event => {
    console.log(event.taskId, event.status);
  });
  ```

- Zero-config MCP OAuth now identifies Mastra Code with its Client ID Metadata Document (`https://code.mastra.ai/.well-known/oauth-client/mastracode.json`) instead of dynamic client registration, which `@mastra/mcp` 2.x no longer performs. Servers whose authorization server accepts URL-based client IDs keep working with a bare `url` entry; servers that require a registered client need `oauth.clientId` in `mcp.json`. ([#23876](https://github.com/mastra-ai/mastra/pull/23876))

  ```json
  {
    "mcpServers": {
      "notes": {
        "url": "https://notes.example.com/mcp"
      },
      "billing": {
        "url": "https://billing.example.com/mcp",
        "oauth": {
          "clientId": "mastra-code-billing",
          "scopes": ["invoices:read"]
        }
      }
    }
  }
  ```

- Added `context.getStorage()` for plugins that start nested controllers. It supplies the host's storage, backend, and vector instances so plugins can avoid opening shared SQLite files through separate native libraries. ([#24132](https://github.com/mastra-ai/mastra/pull/24132))

  ```ts
  const sharedStorage = context.getStorage?.();
  if (!sharedStorage) throw new Error('Shared storage requires a newer Mastra Code host.');
  const nested = await bootLocalAgentController({ cwd: context.cwd, ...sharedStorage });
  ```

  The host owns these instances. Nested controllers must not close them or run storage maintenance on them.

### Patch Changes

- Rotate OAuth accounts automatically on eligible request failures. When the active account is rate-limited, quota-exhausted, or fails authentication after one forced token refresh, Mastra Code activates the next account in the pool and retries the request. Server errors and outages exhaust the transient retry budget first and then surface without another account being activated. Every switch appears in the transcript as a one-line notice and is persisted in thread history. ([#23711](https://github.com/mastra-ai/mastra/pull/23711))

  Add accounts through the TUI — `/login` on an already-connected provider offers **Add another account**:

  ```text
  /login
    → Add another account        # completes OAuth, returns to the manager
    → (submenu) Set as active    # optional; rotation happens on demand anyway
  ```

  No configuration is needed beyond having two or more accounts for a provider; rotation walks the provider's accounts in insertion order, starting from the account the pool is currently on.

- Fixed a zod version mismatch that could make tool and workflow schemas built by these packages incompatible with schemas from @mastra/core. ([#24428](https://github.com/mastra-ai/mastra/pull/24428))

- Fixed low-priority fire-and-forget signals being reported as failed after they were queued for notification summaries. Summarized reply requests now persist the notification but return a clear error instead of falsely recording a reply obligation, so callers can send a new request at a priority that routes directly. Policy-discarded signals remain retryable. ([#23696](https://github.com/mastra-ai/mastra/pull/23696))

- **Breaking change** ([#22978](https://github.com/mastra-ai/mastra/pull/22978))

  Agent Controller streams now emit one complete `message_start` payload, followed by ID-addressed `message_update` events for text, reasoning, and message-part changes. `message_end` now contains only the message ID.

  **Migration**

  Previously, consumers read the complete message from each update. Now, store the start payload by ID and apply subsequent updates to that message:

  ```ts
  if (event.type === 'message_start') messages.set(event.message.id, event.message);
  if (event.type === 'message_update') applyUpdate(messages.get(event.id), event.event);
  ```

- Fixed Mastra Code exporting its own traces into whichever Mastra project's `.env` it was launched from, and crashing on startup when that project's `MASTRA_PROJECT_ID` was not a valid id. Mastra Code cloud observability now only reads its own environment variables (or the `/observability connect` settings) and ignores `MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT` from the environment. ([#24627](https://github.com/mastra-ai/mastra/pull/24627))

  If you configured Mastra Code cloud observability through environment variables, rename them:

  ```sh
  # before
  export MASTRA_CLOUD_ACCESS_TOKEN=...
  export MASTRA_PROJECT_ID=...

  # after
  export MASTRACODE_CLOUD_ACCESS_TOKEN=...
  export MASTRACODE_PROJECT_ID=...
  ```

- Added multiple OAuth accounts per provider. Sign in with as many accounts per provider as you like. Running `/login` on an already-connected provider opens an account manager. There you can add another account, switch the active one, re-authenticate, or remove accounts. Added accounts stay inactive until you select one. Accounts carry labels — email for ChatGPT/xAI, GitHub login for Copilot. Credentials keep the same `auth.json` slot format, so existing setups are untouched. ([#23709](https://github.com/mastra-ai/mastra/pull/23709))

  Account ids are assigned once, when an account is first registered, and no longer derived from the refresh token — so refreshing a token or re-authenticating an account no longer changes which account it is, and adding an account you already have updates it instead of registering a duplicate for the same subscription. Existing `auth.json` files are read as-is; registered accounts additionally learn their provider's stable account identifier on next load, where the provider exposes one.

  Add and select accounts from `/login`:

  ```text
  /login               # choose a provider you are already signed in to
  Add another account  # sign in again; the new account is registered but inactive
  Set as active        # make an added account the one new requests use
  ```

- Fixed the goal box appearing twice in the transcript. ([#24342](https://github.com/mastra-ai/mastra/pull/24342))

  Starting or resuming a goal drew the goal box locally and the agent also echoed the same reminder back into the live transcript, so the goal was shown twice in a row. The box is now rendered once, from the echoed reminder.

  The reminder keeps the goal's attempt budget and judge model, so the box shows both instead of dropping the attempt count. The same reminder is also deduplicated, so a repeated signal cannot render the box a second time.

- Improved cross-agent discovery with live thread titles and passive sender attribution for individually delivered peer signals. ([#23696](https://github.com/mastra-ai/mastra/pull/23696))

  Inbound peer signals now expose the stable sender id as `sourcePeerId`, including fire-and-forget messages, while `returnPeerId` is included only when a reply is required. Low-priority signals may first appear as a count-only notification summary and expose their full attribution when opened from the notification inbox:

  ```xml
  <notification sourcePeerId="code-agent:resource-1:thread-1" expectsReply="false">
    Peer work completed.
  </notification>
  ```

- Added fallback model packs and pack-specific subscription routing. In `/models`, you can configure a fallback chain and choose the OAuth account each model in a pack uses. A selected account is used **exclusively** for that model: if it fails, the request moves to the pack's fallback chain instead of another account, so a heavy model cannot spend a second subscription's quota. `Automatic` keeps rotating through the provider's accounts in insertion order, starting from the account the pool is currently on, and a fallback pack applies its own routing. Pack hops remain visible in the transcript and persist when you reopen the thread. ([#23725](https://github.com/mastra-ai/mastra/pull/23725))

  Configure both from `/models` — select a pack, then:

  ```
  /models
    → Set fallback…            # choose the pack to hop to when this pool is exhausted
    → Set subscription routing… # per model: pin one account, or Automatic
  ```

  Custom packs can also define an observational memory model. When set, the OM observer and reflector resolve from the active pack and its fallback chain — so OM keeps working when a pack's provider is down. Packs without an OM model keep using your standalone OM configuration, and explicit `/om` overrides still win.

  Both settings live in `settings.json` if you prefer to edit them directly:

  ```json
  {
    "customModelPacks": [
      {
        "name": "Daily",
        "models": {
          "build": "anthropic/claude-sonnet-4-6",
          "memory": "anthropic/claude-haiku-4-5"
        }
      }
    ],
    "models": {
      "packFallbacks": { "custom:Daily": "anthropic" },
      "packAccountPreferences": {
        "custom:Daily": { "anthropic/claude-sonnet-4-6": "anthropic:a1b2c3d4" }
      }
    }
  }
  ```

- Fixed cross-agent signals so a peer stays reachable after a session moves to another conversation. A session advertised only its active thread, so peers that had saved an earlier thread could no longer send messages to it after the user started a new thread or switched threads. Every thread a session has loaded now stays claimed, and a wake sent to a saved thread runs on that thread instead of the session's current one. Peer listings no longer show a session's own earlier threads as discoverable agents. ([#24510](https://github.com/mastra-ai/mastra/pull/24510))

- Updated dependencies [[`81ccd7b`](https://github.com/mastra-ai/mastra/commit/81ccd7b93040952fe9c7168a2757c43a217f0a87), [`a46385d`](https://github.com/mastra-ai/mastra/commit/a46385dc1b773d1e1453627b1d62e7b6ebe93cf1), [`1e68460`](https://github.com/mastra-ai/mastra/commit/1e68460205d0061c6dbc7a7e7a50950236af774b), [`372dfed`](https://github.com/mastra-ai/mastra/commit/372dfed464ad1cbf2d42e5559f08205eea8d54a0), [`4266b67`](https://github.com/mastra-ai/mastra/commit/4266b677d33bb20651ca296f64aa91fa3b3d4e82), [`d21aa84`](https://github.com/mastra-ai/mastra/commit/d21aa84aac0dc61bbc43434af7a3b3180373a8a7), [`291a694`](https://github.com/mastra-ai/mastra/commit/291a694b3f9b7d9a17af7d10ed3c9c357bed7a6c), [`2cb5319`](https://github.com/mastra-ai/mastra/commit/2cb5319fc72ef20e7feebfa1e786ff78956aae84), [`a0fbeab`](https://github.com/mastra-ai/mastra/commit/a0fbeabf6298854bcc6d64c8b31530bedd1ea934), [`9f99c76`](https://github.com/mastra-ai/mastra/commit/9f99c76992265f94ff3a6680dc0d2a337d7ef8f1), [`7cfa0df`](https://github.com/mastra-ai/mastra/commit/7cfa0df76759a31b54dd1a87bc95d3064f2026e9), [`b246a1b`](https://github.com/mastra-ai/mastra/commit/b246a1ba0cec1ca2781c661a6b90c777520b64c7), [`0ca5d6d`](https://github.com/mastra-ai/mastra/commit/0ca5d6d58a24e73a364451660a5a8696883eba45), [`f43da93`](https://github.com/mastra-ai/mastra/commit/f43da9335acf26f9d18a1fa4abb49efe70be935e), [`291a694`](https://github.com/mastra-ai/mastra/commit/291a694b3f9b7d9a17af7d10ed3c9c357bed7a6c), [`79385bb`](https://github.com/mastra-ai/mastra/commit/79385bbd8a52ed5e5536b16190dd8b8ac1ee0840), [`bec18d0`](https://github.com/mastra-ai/mastra/commit/bec18d05e7f997ead6ada04a4dc0179c3cad8aa2), [`9cfb572`](https://github.com/mastra-ai/mastra/commit/9cfb5720d30af5421c021ab2cf8edd7a517b0442), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`6ef8186`](https://github.com/mastra-ai/mastra/commit/6ef8186ade9c8ca69269deed07fd47a942ecf70d), [`f6e7562`](https://github.com/mastra-ai/mastra/commit/f6e7562b2ccfdd5d7d77a7eeea0849b6ffd2ec94), [`11560f5`](https://github.com/mastra-ai/mastra/commit/11560f54627055f5ae541a6825669778983a23c9), [`2480359`](https://github.com/mastra-ai/mastra/commit/248035940aa048c7bcd8cfe7845915dc4734b571), [`abecb67`](https://github.com/mastra-ai/mastra/commit/abecb6709643785fd87a3ff9251032a61479ccab), [`697fecc`](https://github.com/mastra-ai/mastra/commit/697feccaa4ad5df913c22e47bf16f493dd7956a8), [`bec18d0`](https://github.com/mastra-ai/mastra/commit/bec18d05e7f997ead6ada04a4dc0179c3cad8aa2), [`2ea44c1`](https://github.com/mastra-ai/mastra/commit/2ea44c1b578d8116507160ac32c7824faa07158e), [`f27f915`](https://github.com/mastra-ai/mastra/commit/f27f91577fd2c9b0984b861b6fc6c919319994de), [`9fe69d6`](https://github.com/mastra-ai/mastra/commit/9fe69d6566c3e6d1e5c9f5bf5e9848b35c73e182), [`25d940a`](https://github.com/mastra-ai/mastra/commit/25d940add25504daebe65bc5cc02f268d6eba07c), [`467e0a6`](https://github.com/mastra-ai/mastra/commit/467e0a630db09a1750ce9271bddb38e46681bf04), [`bb3ee38`](https://github.com/mastra-ai/mastra/commit/bb3ee38e71141570f1e7b0382a6a3cde3036ac36), [`13b0f30`](https://github.com/mastra-ai/mastra/commit/13b0f304533a43df7a7c486b6f37c9dca2187ecf), [`ee7187e`](https://github.com/mastra-ai/mastra/commit/ee7187e7bf66db46630f33c64e86b1ff7bb0c0b7), [`0bf287c`](https://github.com/mastra-ai/mastra/commit/0bf287c36ec14b45f5a4fdd0d279698694f592dd), [`89b8005`](https://github.com/mastra-ai/mastra/commit/89b8005902259b7c53b4079787a4798262b83192), [`aa6225f`](https://github.com/mastra-ai/mastra/commit/aa6225f9aac0c09843d573dcc58eea601bfcc8d7), [`acc7af1`](https://github.com/mastra-ai/mastra/commit/acc7af1da92ea93791cea5ced1e63bc7f0c886ca), [`b2942c0`](https://github.com/mastra-ai/mastra/commit/b2942c0f3c99dd1edba9dc8c2c17bfa55c851ae8), [`6249741`](https://github.com/mastra-ai/mastra/commit/6249741f8463bdc5a05ded2b35b143f92f33afbf), [`99fab39`](https://github.com/mastra-ai/mastra/commit/99fab399c35952ae15427ea64845d4762e9ec144), [`725c307`](https://github.com/mastra-ai/mastra/commit/725c307db7d422a7b1881e0a58a5cec963258ddd), [`cd6948c`](https://github.com/mastra-ai/mastra/commit/cd6948c50aa4478d795613bdfa2d5259a7045026), [`2480359`](https://github.com/mastra-ai/mastra/commit/248035940aa048c7bcd8cfe7845915dc4734b571), [`53519a2`](https://github.com/mastra-ai/mastra/commit/53519a29ce0063712786b74973ae2dbe97a433a7), [`15d3e76`](https://github.com/mastra-ai/mastra/commit/15d3e7647636c7286650ef517953c9885806c3dd), [`02f8f09`](https://github.com/mastra-ai/mastra/commit/02f8f09bc3665ed9a82ffbbc769e42e6027dc29b), [`34e4d21`](https://github.com/mastra-ai/mastra/commit/34e4d21e62c61e11e52aa7d6c39748b1120fbb93), [`8702f39`](https://github.com/mastra-ai/mastra/commit/8702f39331322ef0296fd3d68c0bd0997079faaa), [`d7f0579`](https://github.com/mastra-ai/mastra/commit/d7f0579a0445469430b9eadbf9c28ed3fa009839), [`f5bfa09`](https://github.com/mastra-ai/mastra/commit/f5bfa0934a6d62c0ecb99106586ab7f68a4c283a), [`f4c8b10`](https://github.com/mastra-ai/mastra/commit/f4c8b10d40353563603f795b380176ddc96de2f3), [`bec18d0`](https://github.com/mastra-ai/mastra/commit/bec18d05e7f997ead6ada04a4dc0179c3cad8aa2), [`5014bf6`](https://github.com/mastra-ai/mastra/commit/5014bf6a52f04304c30b4e572df4052085e3ac02), [`096825c`](https://github.com/mastra-ai/mastra/commit/096825c0cc37de5f465ecdc6617d642b8c898a78), [`2810b71`](https://github.com/mastra-ai/mastra/commit/2810b716456ced0679e57eb4b1ca7d6ea9ac6e64), [`d65d4d4`](https://github.com/mastra-ai/mastra/commit/d65d4d40a24a482d5b0ee83d9bab6042702ca1be), [`e6072cb`](https://github.com/mastra-ai/mastra/commit/e6072cbbd3482e37027e53e4d62da7aad6a36c41), [`5085475`](https://github.com/mastra-ai/mastra/commit/5085475c0da226e618eb3ee2676d347788c3fb00), [`c016c9b`](https://github.com/mastra-ai/mastra/commit/c016c9bd051612714e662588e5928b72bd6a6ac6), [`644ac13`](https://github.com/mastra-ai/mastra/commit/644ac131110a9f24a8d92b62dd3777384211a2e7), [`9cfb572`](https://github.com/mastra-ai/mastra/commit/9cfb5720d30af5421c021ab2cf8edd7a517b0442), [`b483910`](https://github.com/mastra-ai/mastra/commit/b48391034dee9a19396c1b3ec084ecf20faf550e), [`3c86726`](https://github.com/mastra-ai/mastra/commit/3c867260be59d3cd8337bc0af9a76bac517fe16f), [`6fd532a`](https://github.com/mastra-ai/mastra/commit/6fd532a2462858637a5f0b38096e9ab105bc146f), [`fec1259`](https://github.com/mastra-ai/mastra/commit/fec125946766805f3122be391272415691de6408), [`285b25a`](https://github.com/mastra-ai/mastra/commit/285b25aa9bb7cc3184991ad01f1acd4895fba076), [`9c98331`](https://github.com/mastra-ai/mastra/commit/9c9833151205c8e9115bf91db2c3914e21bd3e40), [`33a46bd`](https://github.com/mastra-ai/mastra/commit/33a46bd43a5945b052e00341d1eecdcd78327d6e), [`4fb5ae9`](https://github.com/mastra-ai/mastra/commit/4fb5ae9e2cba9b14ba6c5cef0894e49bccf6f607), [`0a989ab`](https://github.com/mastra-ai/mastra/commit/0a989abf37c409040ee2ce9a9ccfcfb5a700508e), [`d4795a4`](https://github.com/mastra-ai/mastra/commit/d4795a42067605d2bbec10ad0b3dcc45acf02147), [`51bbcef`](https://github.com/mastra-ai/mastra/commit/51bbcef0b56a4b1b8f363d3cbf85f04293d4c4ea), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`b87aa0d`](https://github.com/mastra-ai/mastra/commit/b87aa0dc38055558950024f750532ddae6ccf40c), [`ed24c7f`](https://github.com/mastra-ai/mastra/commit/ed24c7f654bb193a0c503469f4f19dda9d687ecb), [`babda00`](https://github.com/mastra-ai/mastra/commit/babda005397d2780aa21be0a7670688b704bdb2f), [`0894a0e`](https://github.com/mastra-ai/mastra/commit/0894a0e6ede48058b547aab5bb8a2a3d71c3878a), [`aa38e6f`](https://github.com/mastra-ai/mastra/commit/aa38e6f424a0eae0e43a5c2ae0b387e404f5e6a6), [`f9e386f`](https://github.com/mastra-ai/mastra/commit/f9e386f308c448761ab9ed0281ae4ab54c99cbd6), [`7075874`](https://github.com/mastra-ai/mastra/commit/7075874b0fb645ffdccd3bee1dfa0daa32892535), [`8d9eadb`](https://github.com/mastra-ai/mastra/commit/8d9eadb59ccbcae054600128aa15d95ea4d1141a), [`2476423`](https://github.com/mastra-ai/mastra/commit/24764233246dc85d7bcba8f8bb610110449a54d6), [`4ab64af`](https://github.com/mastra-ai/mastra/commit/4ab64af6a60f070d65f981bd7fc45c740727e8f3), [`5085475`](https://github.com/mastra-ai/mastra/commit/5085475c0da226e618eb3ee2676d347788c3fb00), [`fa4c366`](https://github.com/mastra-ai/mastra/commit/fa4c3664c5446ae13d991204275883b2d7f00690), [`8d808d8`](https://github.com/mastra-ai/mastra/commit/8d808d8452b8acd5eda4f8cfe014331a8c0f1e92), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`e581e66`](https://github.com/mastra-ai/mastra/commit/e581e66e14bb1b2863698aecca7324fbf1ec4ff5), [`34fd538`](https://github.com/mastra-ai/mastra/commit/34fd538060402e414bdf65af9f469e7bff60be1e), [`1670091`](https://github.com/mastra-ai/mastra/commit/16700919c35dadb9737dc7fe7e5feb67cc209494), [`53519a2`](https://github.com/mastra-ai/mastra/commit/53519a29ce0063712786b74973ae2dbe97a433a7), [`a3f8f05`](https://github.com/mastra-ai/mastra/commit/a3f8f05ecb60c52056c590325e3821ecfc85afe3), [`58c88c4`](https://github.com/mastra-ai/mastra/commit/58c88c4e58504176ccb06d52df9440105aca788d), [`53519a2`](https://github.com/mastra-ai/mastra/commit/53519a29ce0063712786b74973ae2dbe97a433a7), [`fef227a`](https://github.com/mastra-ai/mastra/commit/fef227a8b7cb0ad7f68087e26d1fd2051054a61a), [`f43da93`](https://github.com/mastra-ai/mastra/commit/f43da9335acf26f9d18a1fa4abb49efe70be935e), [`f27f915`](https://github.com/mastra-ai/mastra/commit/f27f91577fd2c9b0984b861b6fc6c919319994de), [`13b0f30`](https://github.com/mastra-ai/mastra/commit/13b0f304533a43df7a7c486b6f37c9dca2187ecf), [`d39b43b`](https://github.com/mastra-ai/mastra/commit/d39b43beada08e69a962a47b58d743384722cd1f), [`b8e3ee5`](https://github.com/mastra-ai/mastra/commit/b8e3ee5da5cbc46b182ca75214acda667bac5205), [`02f8f09`](https://github.com/mastra-ai/mastra/commit/02f8f09bc3665ed9a82ffbbc769e42e6027dc29b), [`9cd9b4e`](https://github.com/mastra-ai/mastra/commit/9cd9b4eca69a3db0a0c415d0dcedf266cc7d5ec6), [`bdab4a8`](https://github.com/mastra-ai/mastra/commit/bdab4a889808d502f398a8086af3b50cc3bfbcd5), [`89b8005`](https://github.com/mastra-ai/mastra/commit/89b8005902259b7c53b4079787a4798262b83192), [`0ca5d6d`](https://github.com/mastra-ai/mastra/commit/0ca5d6d58a24e73a364451660a5a8696883eba45), [`fc1e4f2`](https://github.com/mastra-ai/mastra/commit/fc1e4f2d4e0c1caa9d29de02f7be6a7d69ee2ea2), [`fa08939`](https://github.com/mastra-ai/mastra/commit/fa08939df788c81feb3f0afe70e10a3c40072f93), [`53cdd63`](https://github.com/mastra-ai/mastra/commit/53cdd6368b12aea743f95118a49fc6b93985fd20), [`3589cde`](https://github.com/mastra-ai/mastra/commit/3589cde4ea8dd210df6b9a2355a3e568210965fc), [`d777788`](https://github.com/mastra-ai/mastra/commit/d7777889d72b4f37a3d50b830f8208c736ee0e7a), [`5085475`](https://github.com/mastra-ai/mastra/commit/5085475c0da226e618eb3ee2676d347788c3fb00), [`8808c0e`](https://github.com/mastra-ai/mastra/commit/8808c0e8da55e2ede9deff173da877ee5972bf07), [`b246a1b`](https://github.com/mastra-ai/mastra/commit/b246a1ba0cec1ca2781c661a6b90c777520b64c7), [`5968b71`](https://github.com/mastra-ai/mastra/commit/5968b718044f8dd21bab6ce4ae7da3590729842b), [`76c7d98`](https://github.com/mastra-ai/mastra/commit/76c7d989f691510d7bfc016723cc78d7e08ac108), [`9c98331`](https://github.com/mastra-ai/mastra/commit/9c9833151205c8e9115bf91db2c3914e21bd3e40), [`dafabf2`](https://github.com/mastra-ai/mastra/commit/dafabf22e4f4b0aabecb09839de5abe54e03151a), [`150a670`](https://github.com/mastra-ai/mastra/commit/150a67086539eea91cac3550fc068e6ac5c7e79b), [`f8683b3`](https://github.com/mastra-ai/mastra/commit/f8683b3f45fcc1b92cebe74991b94653a1fafab2), [`c6fff55`](https://github.com/mastra-ai/mastra/commit/c6fff55224ea28752201b9ed4e8dc4449dde9cb9), [`9fe69d6`](https://github.com/mastra-ai/mastra/commit/9fe69d6566c3e6d1e5c9f5bf5e9848b35c73e182), [`73ab51d`](https://github.com/mastra-ai/mastra/commit/73ab51dbb3d29413cae0a5bf5875cfa0382a589a), [`783e48a`](https://github.com/mastra-ai/mastra/commit/783e48aba82489a085230f6b8539a9fb338c326b), [`aee580d`](https://github.com/mastra-ai/mastra/commit/aee580d98976560e68e401c36790ce0cc6443aad), [`b26e528`](https://github.com/mastra-ai/mastra/commit/b26e5288891641044a3c26a498c06259985fed10), [`04cc1b6`](https://github.com/mastra-ai/mastra/commit/04cc1b64c5895d51a4e0b7d5a957b01528a578ef), [`b246a1b`](https://github.com/mastra-ai/mastra/commit/b246a1ba0cec1ca2781c661a6b90c777520b64c7), [`61f953a`](https://github.com/mastra-ai/mastra/commit/61f953a79736ac0d8a9650f0561c6dab1b097c8e), [`56680bf`](https://github.com/mastra-ai/mastra/commit/56680bfff71e7cdad71721b424b160bdd5de6e02), [`93a3425`](https://github.com/mastra-ai/mastra/commit/93a342569d592d0449eee7b4b4f7555dc001081b), [`32edb03`](https://github.com/mastra-ai/mastra/commit/32edb0371b8d884bee66897f236e852a959ae07a), [`7c73bac`](https://github.com/mastra-ai/mastra/commit/7c73baccc8336a4fb0db92614bf778bae5459e24), [`1e66ed0`](https://github.com/mastra-ai/mastra/commit/1e66ed0d24b7e5e88a6d0776bffc1232152a7d75), [`b130872`](https://github.com/mastra-ai/mastra/commit/b130872508e95f17894c2ed4932d4952db0a2d3c), [`e3c1e66`](https://github.com/mastra-ai/mastra/commit/e3c1e664f2681b3fbf4ef14aa9fc255084d78d3e), [`a2c9876`](https://github.com/mastra-ai/mastra/commit/a2c9876f0d76a3b50ea28e6bab71de0ff4bd78a8), [`6c781fd`](https://github.com/mastra-ai/mastra/commit/6c781fda62eb0b0b74d016f188ed0b2db5cfdceb), [`1853f3d`](https://github.com/mastra-ai/mastra/commit/1853f3d9331e3131930581556df781cca85f2d2d), [`b2f412a`](https://github.com/mastra-ai/mastra/commit/b2f412ae77fa5379471d103ebcc1ba69b22dd353), [`9cfb572`](https://github.com/mastra-ai/mastra/commit/9cfb5720d30af5421c021ab2cf8edd7a517b0442), [`bc12e6c`](https://github.com/mastra-ai/mastra/commit/bc12e6cd9cc74fb078b006ed5d14429e2101cbb2), [`fdb59c6`](https://github.com/mastra-ai/mastra/commit/fdb59c6a4c3d9aea19159886aac8d80602763f04), [`07a81c8`](https://github.com/mastra-ai/mastra/commit/07a81c8be0cbdb5413ffa5c289d32765d80f4ea4), [`07ff1b8`](https://github.com/mastra-ai/mastra/commit/07ff1b8eafbd9c7786ef77decc6be3b63497cfd9), [`c6999e2`](https://github.com/mastra-ai/mastra/commit/c6999e2b4ab805301e66723ca8ba9fe30faa82ca), [`9cfb572`](https://github.com/mastra-ai/mastra/commit/9cfb5720d30af5421c021ab2cf8edd7a517b0442), [`0ca5d6d`](https://github.com/mastra-ai/mastra/commit/0ca5d6d58a24e73a364451660a5a8696883eba45)]:
  - @mastra/core@1.68.0
  - @mastra/observability@1.17.9
  - @mastra/memory@1.31.0
  - @mastra/pg@1.26.0
  - @mastra/mcp@2.0.0
  - @mastra/duckdb@1.10.0
  - @mastra/libsql@1.23.1
  - @mastra/schema-compat@1.3.11
  - @mastra/github-signals@0.5.0
  - @mastra/parallel@0.1.2

## 1.8.0-alpha.12

### Patch Changes

- Fixed Mastra Code exporting its own traces into whichever Mastra project's `.env` it was launched from, and crashing on startup when that project's `MASTRA_PROJECT_ID` was not a valid id. Mastra Code cloud observability now only reads its own environment variables (or the `/observability connect` settings) and ignores `MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT` from the environment. ([#24627](https://github.com/mastra-ai/mastra/pull/24627))

  If you configured Mastra Code cloud observability through environment variables, rename them:

  ```sh
  # before
  export MASTRA_CLOUD_ACCESS_TOKEN=...
  export MASTRA_PROJECT_ID=...

  # after
  export MASTRACODE_CLOUD_ACCESS_TOKEN=...
  export MASTRACODE_PROJECT_ID=...
  ```

- Updated dependencies [[`f9e386f`](https://github.com/mastra-ai/mastra/commit/f9e386f308c448761ab9ed0281ae4ab54c99cbd6)]:
  - @mastra/observability@1.17.9-alpha.2
  - @mastra/mcp@2.0.0-alpha.5

## 1.8.0-alpha.11

### Patch Changes

- Fixed cross-agent signals so a peer stays reachable after a session moves to another conversation. A session advertised only its active thread, so peers that had saved an earlier thread could no longer send messages to it after the user started a new thread or switched threads. Every thread a session has loaded now stays claimed, and a wake sent to a saved thread runs on that thread instead of the session's current one. Peer listings no longer show a session's own earlier threads as discoverable agents. ([#24510](https://github.com/mastra-ai/mastra/pull/24510))

- Updated dependencies [[`f43da93`](https://github.com/mastra-ai/mastra/commit/f43da9335acf26f9d18a1fa4abb49efe70be935e), [`9cfb572`](https://github.com/mastra-ai/mastra/commit/9cfb5720d30af5421c021ab2cf8edd7a517b0442), [`89b8005`](https://github.com/mastra-ai/mastra/commit/89b8005902259b7c53b4079787a4798262b83192), [`02f8f09`](https://github.com/mastra-ai/mastra/commit/02f8f09bc3665ed9a82ffbbc769e42e6027dc29b), [`9cfb572`](https://github.com/mastra-ai/mastra/commit/9cfb5720d30af5421c021ab2cf8edd7a517b0442), [`6fd532a`](https://github.com/mastra-ai/mastra/commit/6fd532a2462858637a5f0b38096e9ab105bc146f), [`33a46bd`](https://github.com/mastra-ai/mastra/commit/33a46bd43a5945b052e00341d1eecdcd78327d6e), [`f43da93`](https://github.com/mastra-ai/mastra/commit/f43da9335acf26f9d18a1fa4abb49efe70be935e), [`02f8f09`](https://github.com/mastra-ai/mastra/commit/02f8f09bc3665ed9a82ffbbc769e42e6027dc29b), [`89b8005`](https://github.com/mastra-ai/mastra/commit/89b8005902259b7c53b4079787a4798262b83192), [`fa08939`](https://github.com/mastra-ai/mastra/commit/fa08939df788c81feb3f0afe70e10a3c40072f93), [`9cfb572`](https://github.com/mastra-ai/mastra/commit/9cfb5720d30af5421c021ab2cf8edd7a517b0442), [`9cfb572`](https://github.com/mastra-ai/mastra/commit/9cfb5720d30af5421c021ab2cf8edd7a517b0442)]:
  - @mastra/core@1.68.0-alpha.11
  - @mastra/pg@1.26.0-alpha.5
  - @mastra/mcp@2.0.0-alpha.5
  - @mastra/libsql@1.23.1-alpha.3
  - @mastra/duckdb@1.10.0-alpha.3

## 1.8.0-alpha.10

### Patch Changes

- Updated dependencies [[`372dfed`](https://github.com/mastra-ai/mastra/commit/372dfed464ad1cbf2d42e5559f08205eea8d54a0)]:
  - @mastra/core@1.68.0-alpha.10

## 1.8.0-alpha.9

### Patch Changes

- Updated dependencies [[`2cb5319`](https://github.com/mastra-ai/mastra/commit/2cb5319fc72ef20e7feebfa1e786ff78956aae84), [`f6e7562`](https://github.com/mastra-ai/mastra/commit/f6e7562b2ccfdd5d7d77a7eeea0849b6ffd2ec94), [`53519a2`](https://github.com/mastra-ai/mastra/commit/53519a29ce0063712786b74973ae2dbe97a433a7), [`d4795a4`](https://github.com/mastra-ai/mastra/commit/d4795a42067605d2bbec10ad0b3dcc45acf02147), [`b87aa0d`](https://github.com/mastra-ai/mastra/commit/b87aa0dc38055558950024f750532ddae6ccf40c), [`53519a2`](https://github.com/mastra-ai/mastra/commit/53519a29ce0063712786b74973ae2dbe97a433a7), [`53519a2`](https://github.com/mastra-ai/mastra/commit/53519a29ce0063712786b74973ae2dbe97a433a7)]:
  - @mastra/core@1.68.0-alpha.9
  - @mastra/libsql@1.23.1-alpha.2
  - @mastra/pg@1.26.0-alpha.4

## 1.8.0-alpha.8

### Patch Changes

- Rotate OAuth accounts automatically on eligible request failures. When the active account is rate-limited, quota-exhausted, or fails authentication after one forced token refresh, Mastra Code activates the next account in the pool and retries the request. Server errors and outages exhaust the transient retry budget first and then surface without another account being activated. Every switch appears in the transcript as a one-line notice and is persisted in thread history. ([#23711](https://github.com/mastra-ai/mastra/pull/23711))

  Add accounts through the TUI — `/login` on an already-connected provider offers **Add another account**:

  ```text
  /login
    → Add another account        # completes OAuth, returns to the manager
    → (submenu) Set as active    # optional; rotation happens on demand anyway
  ```

  No configuration is needed beyond having two or more accounts for a provider; rotation walks the provider's accounts in insertion order, starting from the account the pool is currently on.

- Added multiple OAuth accounts per provider. Sign in with as many accounts per provider as you like. Running `/login` on an already-connected provider opens an account manager. There you can add another account, switch the active one, re-authenticate, or remove accounts. Added accounts stay inactive until you select one. Accounts carry labels — email for ChatGPT/xAI, GitHub login for Copilot. Credentials keep the same `auth.json` slot format, so existing setups are untouched. ([#23709](https://github.com/mastra-ai/mastra/pull/23709))

  Account ids are assigned once, when an account is first registered, and no longer derived from the refresh token — so refreshing a token or re-authenticating an account no longer changes which account it is, and adding an account you already have updates it instead of registering a duplicate for the same subscription. Existing `auth.json` files are read as-is; registered accounts additionally learn their provider's stable account identifier on next load, where the provider exposes one.

  Add and select accounts from `/login`:

  ```text
  /login               # choose a provider you are already signed in to
  Add another account  # sign in again; the new account is registered but inactive
  Set as active        # make an added account the one new requests use
  ```

- Added fallback model packs and pack-specific subscription routing. In `/models`, you can configure a fallback chain and choose the OAuth account each model in a pack uses. A selected account is used **exclusively** for that model: if it fails, the request moves to the pack's fallback chain instead of another account, so a heavy model cannot spend a second subscription's quota. `Automatic` keeps rotating through the provider's accounts in insertion order, starting from the account the pool is currently on, and a fallback pack applies its own routing. Pack hops remain visible in the transcript and persist when you reopen the thread. ([#23725](https://github.com/mastra-ai/mastra/pull/23725))

  Configure both from `/models` — select a pack, then:

  ```
  /models
    → Set fallback…            # choose the pack to hop to when this pool is exhausted
    → Set subscription routing… # per model: pin one account, or Automatic
  ```

  Custom packs can also define an observational memory model. When set, the OM observer and reflector resolve from the active pack and its fallback chain — so OM keeps working when a pack's provider is down. Packs without an OM model keep using your standalone OM configuration, and explicit `/om` overrides still win.

  Both settings live in `settings.json` if you prefer to edit them directly:

  ```json
  {
    "customModelPacks": [
      {
        "name": "Daily",
        "models": {
          "build": "anthropic/claude-sonnet-4-6",
          "memory": "anthropic/claude-haiku-4-5"
        }
      }
    ],
    "models": {
      "packFallbacks": { "custom:Daily": "anthropic" },
      "packAccountPreferences": {
        "custom:Daily": { "anthropic/claude-sonnet-4-6": "anthropic:a1b2c3d4" }
      }
    }
  }
  ```

- Updated dependencies [[`d21aa84`](https://github.com/mastra-ai/mastra/commit/d21aa84aac0dc61bbc43434af7a3b3180373a8a7), [`a0fbeab`](https://github.com/mastra-ai/mastra/commit/a0fbeabf6298854bcc6d64c8b31530bedd1ea934), [`79385bb`](https://github.com/mastra-ai/mastra/commit/79385bbd8a52ed5e5536b16190dd8b8ac1ee0840), [`5014bf6`](https://github.com/mastra-ai/mastra/commit/5014bf6a52f04304c30b4e572df4052085e3ac02), [`58c88c4`](https://github.com/mastra-ai/mastra/commit/58c88c4e58504176ccb06d52df9440105aca788d), [`fc1e4f2`](https://github.com/mastra-ai/mastra/commit/fc1e4f2d4e0c1caa9d29de02f7be6a7d69ee2ea2), [`aee580d`](https://github.com/mastra-ai/mastra/commit/aee580d98976560e68e401c36790ce0cc6443aad), [`7c73bac`](https://github.com/mastra-ai/mastra/commit/7c73baccc8336a4fb0db92614bf778bae5459e24)]:
  - @mastra/core@1.68.0-alpha.8

## 1.8.0-alpha.7

### Patch Changes

- Fixed a zod version mismatch that could make tool and workflow schemas built by these packages incompatible with schemas from @mastra/core. ([#24428](https://github.com/mastra-ai/mastra/pull/24428))

- Updated dependencies [[`11560f5`](https://github.com/mastra-ai/mastra/commit/11560f54627055f5ae541a6825669778983a23c9), [`9fe69d6`](https://github.com/mastra-ai/mastra/commit/9fe69d6566c3e6d1e5c9f5bf5e9848b35c73e182), [`15d3e76`](https://github.com/mastra-ai/mastra/commit/15d3e7647636c7286650ef517953c9885806c3dd), [`3c86726`](https://github.com/mastra-ai/mastra/commit/3c867260be59d3cd8337bc0af9a76bac517fe16f), [`0a989ab`](https://github.com/mastra-ai/mastra/commit/0a989abf37c409040ee2ce9a9ccfcfb5a700508e), [`ed24c7f`](https://github.com/mastra-ai/mastra/commit/ed24c7f654bb193a0c503469f4f19dda9d687ecb), [`0894a0e`](https://github.com/mastra-ai/mastra/commit/0894a0e6ede48058b547aab5bb8a2a3d71c3878a), [`8808c0e`](https://github.com/mastra-ai/mastra/commit/8808c0e8da55e2ede9deff173da877ee5972bf07), [`5968b71`](https://github.com/mastra-ai/mastra/commit/5968b718044f8dd21bab6ce4ae7da3590729842b), [`dafabf2`](https://github.com/mastra-ai/mastra/commit/dafabf22e4f4b0aabecb09839de5abe54e03151a), [`150a670`](https://github.com/mastra-ai/mastra/commit/150a67086539eea91cac3550fc068e6ac5c7e79b), [`9fe69d6`](https://github.com/mastra-ai/mastra/commit/9fe69d6566c3e6d1e5c9f5bf5e9848b35c73e182), [`c6999e2`](https://github.com/mastra-ai/mastra/commit/c6999e2b4ab805301e66723ca8ba9fe30faa82ca)]:
  - @mastra/core@1.68.0-alpha.7
  - @mastra/github-signals@0.5.0-alpha.1

## 1.8.0-alpha.6

### Minor Changes

- Zero-config MCP OAuth now identifies Mastra Code with its Client ID Metadata Document (`https://code.mastra.ai/.well-known/oauth-client/mastracode.json`) instead of dynamic client registration, which `@mastra/mcp` 2.x no longer performs. Servers whose authorization server accepts URL-based client IDs keep working with a bare `url` entry; servers that require a registered client need `oauth.clientId` in `mcp.json`. ([#23876](https://github.com/mastra-ai/mastra/pull/23876))

  ```json
  {
    "mcpServers": {
      "notes": {
        "url": "https://notes.example.com/mcp"
      },
      "billing": {
        "url": "https://billing.example.com/mcp",
        "oauth": {
          "clientId": "mastra-code-billing",
          "scopes": ["invoices:read"]
        }
      }
    }
  }
  ```

### Patch Changes

- Fixed the goal box appearing twice in the transcript. ([#24342](https://github.com/mastra-ai/mastra/pull/24342))

  Starting or resuming a goal drew the goal box locally and the agent also echoed the same reminder back into the live transcript, so the goal was shown twice in a row. The box is now rendered once, from the echoed reminder.

  The reminder keeps the goal's attempt budget and judge model, so the box shows both instead of dropping the attempt count. The same reminder is also deduplicated, so a repeated signal cannot render the box a second time.

- Updated dependencies [[`6ef8186`](https://github.com/mastra-ai/mastra/commit/6ef8186ade9c8ca69269deed07fd47a942ecf70d), [`2ea44c1`](https://github.com/mastra-ai/mastra/commit/2ea44c1b578d8116507160ac32c7824faa07158e), [`34e4d21`](https://github.com/mastra-ai/mastra/commit/34e4d21e62c61e11e52aa7d6c39748b1120fbb93), [`8702f39`](https://github.com/mastra-ai/mastra/commit/8702f39331322ef0296fd3d68c0bd0997079faaa), [`e6072cb`](https://github.com/mastra-ai/mastra/commit/e6072cbbd3482e37027e53e4d62da7aad6a36c41), [`8d808d8`](https://github.com/mastra-ai/mastra/commit/8d808d8452b8acd5eda4f8cfe014331a8c0f1e92)]:
  - @mastra/core@1.68.0-alpha.6
  - @mastra/mcp@2.0.0-alpha.4

## 1.8.0-alpha.5

### Minor Changes

- Added native background tool and delegated subagent support to Mastra Code sessions. ([#19960](https://github.com/mastra-ai/mastra/pull/19960))

  Set `backgroundTools.enabled` to `true` in Mastra Code settings to make read-only workspace tools and the Alexandria expert background-eligible. Eligible tools remain foreground by default, and agents can opt individual calls into `deferred` or `awaited` execution through the Core `_background.disposition` override.

  Mastra Code factory results now expose `backgroundCompletionEvents`, which publishes reconciled `completed`, `failed`, and `cancelled` events for the originating resource and thread:

  ```ts
  const mastraCode = await createMastraCode(options);

  const unsubscribe = mastraCode.backgroundCompletionEvents.subscribe(event => {
    console.log(event.taskId, event.status);
  });
  ```

### Patch Changes

- Updated dependencies [[`4266b67`](https://github.com/mastra-ai/mastra/commit/4266b677d33bb20651ca296f64aa91fa3b3d4e82), [`bec18d0`](https://github.com/mastra-ai/mastra/commit/bec18d05e7f997ead6ada04a4dc0179c3cad8aa2), [`abecb67`](https://github.com/mastra-ai/mastra/commit/abecb6709643785fd87a3ff9251032a61479ccab), [`bec18d0`](https://github.com/mastra-ai/mastra/commit/bec18d05e7f997ead6ada04a4dc0179c3cad8aa2), [`f27f915`](https://github.com/mastra-ai/mastra/commit/f27f91577fd2c9b0984b861b6fc6c919319994de), [`ee7187e`](https://github.com/mastra-ai/mastra/commit/ee7187e7bf66db46630f33c64e86b1ff7bb0c0b7), [`aa6225f`](https://github.com/mastra-ai/mastra/commit/aa6225f9aac0c09843d573dcc58eea601bfcc8d7), [`bec18d0`](https://github.com/mastra-ai/mastra/commit/bec18d05e7f997ead6ada04a4dc0179c3cad8aa2), [`babda00`](https://github.com/mastra-ai/mastra/commit/babda005397d2780aa21be0a7670688b704bdb2f), [`2476423`](https://github.com/mastra-ai/mastra/commit/24764233246dc85d7bcba8f8bb610110449a54d6), [`f27f915`](https://github.com/mastra-ai/mastra/commit/f27f91577fd2c9b0984b861b6fc6c919319994de), [`bdab4a8`](https://github.com/mastra-ai/mastra/commit/bdab4a889808d502f398a8086af3b50cc3bfbcd5), [`53cdd63`](https://github.com/mastra-ai/mastra/commit/53cdd6368b12aea743f95118a49fc6b93985fd20), [`c6fff55`](https://github.com/mastra-ai/mastra/commit/c6fff55224ea28752201b9ed4e8dc4449dde9cb9), [`a2c9876`](https://github.com/mastra-ai/mastra/commit/a2c9876f0d76a3b50ea28e6bab71de0ff4bd78a8)]:
  - @mastra/core@1.68.0-alpha.5
  - @mastra/duckdb@1.10.0-alpha.2
  - @mastra/pg@1.26.0-alpha.3
  - @mastra/parallel@0.1.2-alpha.0
  - @mastra/mcp@1.18.1-alpha.3

## 1.8.0-alpha.4

### Patch Changes

- Updated dependencies [[`2480359`](https://github.com/mastra-ai/mastra/commit/248035940aa048c7bcd8cfe7845915dc4734b571), [`697fecc`](https://github.com/mastra-ai/mastra/commit/697feccaa4ad5df913c22e47bf16f493dd7956a8), [`0bf287c`](https://github.com/mastra-ai/mastra/commit/0bf287c36ec14b45f5a4fdd0d279698694f592dd), [`6249741`](https://github.com/mastra-ai/mastra/commit/6249741f8463bdc5a05ded2b35b143f92f33afbf), [`725c307`](https://github.com/mastra-ai/mastra/commit/725c307db7d422a7b1881e0a58a5cec963258ddd), [`2480359`](https://github.com/mastra-ai/mastra/commit/248035940aa048c7bcd8cfe7845915dc4734b571), [`285b25a`](https://github.com/mastra-ai/mastra/commit/285b25aa9bb7cc3184991ad01f1acd4895fba076), [`51bbcef`](https://github.com/mastra-ai/mastra/commit/51bbcef0b56a4b1b8f363d3cbf85f04293d4c4ea), [`4ab64af`](https://github.com/mastra-ai/mastra/commit/4ab64af6a60f070d65f981bd7fc45c740727e8f3), [`b26e528`](https://github.com/mastra-ai/mastra/commit/b26e5288891641044a3c26a498c06259985fed10), [`b2f412a`](https://github.com/mastra-ai/mastra/commit/b2f412ae77fa5379471d103ebcc1ba69b22dd353)]:
  - @mastra/memory@1.31.0-alpha.3
  - @mastra/core@1.68.0-alpha.4
  - @mastra/mcp@1.18.1-alpha.2
  - @mastra/github-signals@0.5.0-alpha.0

## 1.8.0-alpha.3

### Minor Changes

- Added `context.getStorage()` for plugins that start nested controllers. It supplies the host's storage, backend, and vector instances so plugins can avoid opening shared SQLite files through separate native libraries. ([#24132](https://github.com/mastra-ai/mastra/pull/24132))

  ```ts
  const sharedStorage = context.getStorage?.();
  if (!sharedStorage) throw new Error('Shared storage requires a newer Mastra Code host.');
  const nested = await bootLocalAgentController({ cwd: context.cwd, ...sharedStorage });
  ```

  The host owns these instances. Nested controllers must not close them or run storage maintenance on them.

### Patch Changes

- Fixed low-priority fire-and-forget signals being reported as failed after they were queued for notification summaries. Summarized reply requests now persist the notification but return a clear error instead of falsely recording a reply obligation, so callers can send a new request at a priority that routes directly. Policy-discarded signals remain retryable. ([#23696](https://github.com/mastra-ai/mastra/pull/23696))

- Improved cross-agent discovery with live thread titles and passive sender attribution for individually delivered peer signals. ([#23696](https://github.com/mastra-ai/mastra/pull/23696))

  Inbound peer signals now expose the stable sender id as `sourcePeerId`, including fire-and-forget messages, while `returnPeerId` is included only when a reply is required. Low-priority signals may first appear as a count-only notification summary and expose their full attribution when opened from the notification inbox:

  ```xml
  <notification sourcePeerId="code-agent:resource-1:thread-1" expectsReply="false">
    Peer work completed.
  </notification>
  ```

- Updated dependencies [[`9f99c76`](https://github.com/mastra-ai/mastra/commit/9f99c76992265f94ff3a6680dc0d2a337d7ef8f1), [`b246a1b`](https://github.com/mastra-ai/mastra/commit/b246a1ba0cec1ca2781c661a6b90c777520b64c7), [`0ca5d6d`](https://github.com/mastra-ai/mastra/commit/0ca5d6d58a24e73a364451660a5a8696883eba45), [`13b0f30`](https://github.com/mastra-ai/mastra/commit/13b0f304533a43df7a7c486b6f37c9dca2187ecf), [`acc7af1`](https://github.com/mastra-ai/mastra/commit/acc7af1da92ea93791cea5ced1e63bc7f0c886ca), [`b2942c0`](https://github.com/mastra-ai/mastra/commit/b2942c0f3c99dd1edba9dc8c2c17bfa55c851ae8), [`99fab39`](https://github.com/mastra-ai/mastra/commit/99fab399c35952ae15427ea64845d4762e9ec144), [`d65d4d4`](https://github.com/mastra-ai/mastra/commit/d65d4d40a24a482d5b0ee83d9bab6042702ca1be), [`4fb5ae9`](https://github.com/mastra-ai/mastra/commit/4fb5ae9e2cba9b14ba6c5cef0894e49bccf6f607), [`e581e66`](https://github.com/mastra-ai/mastra/commit/e581e66e14bb1b2863698aecca7324fbf1ec4ff5), [`a3f8f05`](https://github.com/mastra-ai/mastra/commit/a3f8f05ecb60c52056c590325e3821ecfc85afe3), [`13b0f30`](https://github.com/mastra-ai/mastra/commit/13b0f304533a43df7a7c486b6f37c9dca2187ecf), [`9cd9b4e`](https://github.com/mastra-ai/mastra/commit/9cd9b4eca69a3db0a0c415d0dcedf266cc7d5ec6), [`0ca5d6d`](https://github.com/mastra-ai/mastra/commit/0ca5d6d58a24e73a364451660a5a8696883eba45), [`3589cde`](https://github.com/mastra-ai/mastra/commit/3589cde4ea8dd210df6b9a2355a3e568210965fc), [`b246a1b`](https://github.com/mastra-ai/mastra/commit/b246a1ba0cec1ca2781c661a6b90c777520b64c7), [`783e48a`](https://github.com/mastra-ai/mastra/commit/783e48aba82489a085230f6b8539a9fb338c326b), [`04cc1b6`](https://github.com/mastra-ai/mastra/commit/04cc1b64c5895d51a4e0b7d5a957b01528a578ef), [`b246a1b`](https://github.com/mastra-ai/mastra/commit/b246a1ba0cec1ca2781c661a6b90c777520b64c7), [`e3c1e66`](https://github.com/mastra-ai/mastra/commit/e3c1e664f2681b3fbf4ef14aa9fc255084d78d3e), [`07a81c8`](https://github.com/mastra-ai/mastra/commit/07a81c8be0cbdb5413ffa5c289d32765d80f4ea4), [`07ff1b8`](https://github.com/mastra-ai/mastra/commit/07ff1b8eafbd9c7786ef77decc6be3b63497cfd9), [`0ca5d6d`](https://github.com/mastra-ai/mastra/commit/0ca5d6d58a24e73a364451660a5a8696883eba45)]:
  - @mastra/memory@1.31.0-alpha.2
  - @mastra/core@1.68.0-alpha.3
  - @mastra/pg@1.26.0-alpha.2
  - @mastra/duckdb@1.10.0-alpha.1
  - @mastra/libsql@1.23.1-alpha.1

## 1.7.3-alpha.2

### Patch Changes

- Updated dependencies [[`291a694`](https://github.com/mastra-ai/mastra/commit/291a694b3f9b7d9a17af7d10ed3c9c357bed7a6c), [`291a694`](https://github.com/mastra-ai/mastra/commit/291a694b3f9b7d9a17af7d10ed3c9c357bed7a6c), [`467e0a6`](https://github.com/mastra-ai/mastra/commit/467e0a630db09a1750ce9271bddb38e46681bf04), [`f5bfa09`](https://github.com/mastra-ai/mastra/commit/f5bfa0934a6d62c0ecb99106586ab7f68a4c283a), [`5085475`](https://github.com/mastra-ai/mastra/commit/5085475c0da226e618eb3ee2676d347788c3fb00), [`c016c9b`](https://github.com/mastra-ai/mastra/commit/c016c9bd051612714e662588e5928b72bd6a6ac6), [`644ac13`](https://github.com/mastra-ai/mastra/commit/644ac131110a9f24a8d92b62dd3777384211a2e7), [`9c98331`](https://github.com/mastra-ai/mastra/commit/9c9833151205c8e9115bf91db2c3914e21bd3e40), [`aa38e6f`](https://github.com/mastra-ai/mastra/commit/aa38e6f424a0eae0e43a5c2ae0b387e404f5e6a6), [`8d9eadb`](https://github.com/mastra-ai/mastra/commit/8d9eadb59ccbcae054600128aa15d95ea4d1141a), [`5085475`](https://github.com/mastra-ai/mastra/commit/5085475c0da226e618eb3ee2676d347788c3fb00), [`5085475`](https://github.com/mastra-ai/mastra/commit/5085475c0da226e618eb3ee2676d347788c3fb00), [`76c7d98`](https://github.com/mastra-ai/mastra/commit/76c7d989f691510d7bfc016723cc78d7e08ac108), [`9c98331`](https://github.com/mastra-ai/mastra/commit/9c9833151205c8e9115bf91db2c3914e21bd3e40), [`f8683b3`](https://github.com/mastra-ai/mastra/commit/f8683b3f45fcc1b92cebe74991b94653a1fafab2), [`61f953a`](https://github.com/mastra-ai/mastra/commit/61f953a79736ac0d8a9650f0561c6dab1b097c8e), [`32edb03`](https://github.com/mastra-ai/mastra/commit/32edb0371b8d884bee66897f236e852a959ae07a), [`6c781fd`](https://github.com/mastra-ai/mastra/commit/6c781fda62eb0b0b74d016f188ed0b2db5cfdceb), [`bc12e6c`](https://github.com/mastra-ai/mastra/commit/bc12e6cd9cc74fb078b006ed5d14429e2101cbb2)]:
  - @mastra/observability@1.17.9-alpha.1
  - @mastra/core@1.68.0-alpha.2
  - @mastra/schema-compat@1.3.11-alpha.1
  - @mastra/duckdb@1.10.0-alpha.0
  - @mastra/memory@1.31.0-alpha.1
  - @mastra/pg@1.26.0-alpha.1
  - @mastra/mcp@1.18.1-alpha.1

## 1.7.3-alpha.1

### Patch Changes

- Updated dependencies [[`81ccd7b`](https://github.com/mastra-ai/mastra/commit/81ccd7b93040952fe9c7168a2757c43a217f0a87), [`a46385d`](https://github.com/mastra-ai/mastra/commit/a46385dc1b773d1e1453627b1d62e7b6ebe93cf1), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`25d940a`](https://github.com/mastra-ai/mastra/commit/25d940add25504daebe65bc5cc02f268d6eba07c), [`bb3ee38`](https://github.com/mastra-ai/mastra/commit/bb3ee38e71141570f1e7b0382a6a3cde3036ac36), [`d7f0579`](https://github.com/mastra-ai/mastra/commit/d7f0579a0445469430b9eadbf9c28ed3fa009839), [`f4c8b10`](https://github.com/mastra-ai/mastra/commit/f4c8b10d40353563603f795b380176ddc96de2f3), [`b483910`](https://github.com/mastra-ai/mastra/commit/b48391034dee9a19396c1b3ec084ecf20faf550e), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`7075874`](https://github.com/mastra-ai/mastra/commit/7075874b0fb645ffdccd3bee1dfa0daa32892535), [`fa4c366`](https://github.com/mastra-ai/mastra/commit/fa4c3664c5446ae13d991204275883b2d7f00690), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`1670091`](https://github.com/mastra-ai/mastra/commit/16700919c35dadb9737dc7fe7e5feb67cc209494), [`fef227a`](https://github.com/mastra-ai/mastra/commit/fef227a8b7cb0ad7f68087e26d1fd2051054a61a), [`b8e3ee5`](https://github.com/mastra-ai/mastra/commit/b8e3ee5da5cbc46b182ca75214acda667bac5205), [`d777788`](https://github.com/mastra-ai/mastra/commit/d7777889d72b4f37a3d50b830f8208c736ee0e7a), [`56680bf`](https://github.com/mastra-ai/mastra/commit/56680bfff71e7cdad71721b424b160bdd5de6e02), [`93a3425`](https://github.com/mastra-ai/mastra/commit/93a342569d592d0449eee7b4b4f7555dc001081b), [`1e66ed0`](https://github.com/mastra-ai/mastra/commit/1e66ed0d24b7e5e88a6d0776bffc1232152a7d75), [`b130872`](https://github.com/mastra-ai/mastra/commit/b130872508e95f17894c2ed4932d4952db0a2d3c), [`1853f3d`](https://github.com/mastra-ai/mastra/commit/1853f3d9331e3131930581556df781cca85f2d2d), [`fdb59c6`](https://github.com/mastra-ai/mastra/commit/fdb59c6a4c3d9aea19159886aac8d80602763f04)]:
  - @mastra/core@1.68.0-alpha.1
  - @mastra/mcp@1.18.1-alpha.0
  - @mastra/libsql@1.23.1-alpha.0
  - @mastra/pg@1.25.1-alpha.0
  - @mastra/memory@1.31.0-alpha.0
  - @mastra/schema-compat@1.3.11-alpha.0

## 1.7.3-alpha.0

### Patch Changes

- **Breaking change** ([#22978](https://github.com/mastra-ai/mastra/pull/22978))

  Agent Controller streams now emit one complete `message_start` payload, followed by ID-addressed `message_update` events for text, reasoning, and message-part changes. `message_end` now contains only the message ID.

  **Migration**

  Previously, consumers read the complete message from each update. Now, store the start payload by ID and apply subsequent updates to that message:

  ```ts
  if (event.type === 'message_start') messages.set(event.message.id, event.message);
  if (event.type === 'message_update') applyUpdate(messages.get(event.id), event.event);
  ```

- Updated dependencies [[`1e68460`](https://github.com/mastra-ai/mastra/commit/1e68460205d0061c6dbc7a7e7a50950236af774b), [`7cfa0df`](https://github.com/mastra-ai/mastra/commit/7cfa0df76759a31b54dd1a87bc95d3064f2026e9), [`cd6948c`](https://github.com/mastra-ai/mastra/commit/cd6948c50aa4478d795613bdfa2d5259a7045026), [`096825c`](https://github.com/mastra-ai/mastra/commit/096825c0cc37de5f465ecdc6617d642b8c898a78), [`2810b71`](https://github.com/mastra-ai/mastra/commit/2810b716456ced0679e57eb4b1ca7d6ea9ac6e64), [`fec1259`](https://github.com/mastra-ai/mastra/commit/fec125946766805f3122be391272415691de6408), [`34fd538`](https://github.com/mastra-ai/mastra/commit/34fd538060402e414bdf65af9f469e7bff60be1e), [`d39b43b`](https://github.com/mastra-ai/mastra/commit/d39b43beada08e69a962a47b58d743384722cd1f)]:
  - @mastra/core@1.68.0-alpha.0
  - @mastra/observability@1.17.9-alpha.0
  - @mastra/mcp@1.18.0

## 1.7.2

### Patch Changes

- Fix Bedrock prompt caching to enable by default for all cache-capable Claude models. ([#23556](https://github.com/mastra-ai/mastra/pull/23556))

  The gate now enumerates the closed set of legacy Claude 3.x models that support caching and defaults every newer Anthropic family on, instead of matching an allow-list of current model IDs. The old allow-list was permanently behind — newly released cache-capable models were silently billed at full input rate (~10x the cached cost) until their IDs were manually appended.

  - Claude 4+ and all named families (opus-5, sonnet-5, fable, mythos, and future families) now cache without a code change.
  - `claude-3-5-sonnet-20240620` and non-Anthropic models remain correctly excluded.

  Fixes #23552.

- Forwarded `updateNotificationsStatus` through the lazy notifications storage so the inbox tool's bulk seen-marking reaches the configured store. ([#23718](https://github.com/mastra-ai/mastra/pull/23718))

- Clarified cross-agent peer states, required fresh discovery before sends, bounded expected-reply reminders when a peer becomes unavailable, and added an explicit disconnect tool. Agents can remove a saved connection from the current sender thread with the peer's stable ID: ([#21986](https://github.com/mastra-ai/mastra/pull/21986))

  ```text
  agent_disconnect({ targetId: "code-agent:resource-id:thread-id" })
  ```

- The sandbox-backed workspace filesystem now runs `list_files` tree walks and `grep` searches inside the sandbox in a single command (using `find` and `rg`/`grep`), instead of one round trip per directory and file. `walk()` throws `DirectoryNotFoundError` / `NotDirectoryError` for a missing or non-directory root and reports symlink targets. Ripgrep results are kept when `rg` exits with a per-file error (for example an unreadable file) instead of being discarded, and patterns whose meaning differs between POSIX ERE and JavaScript regex (`[[:digit:]]`, `\<`, `\>`) fall back to the host-side search so match columns stay correct. ([#22317](https://github.com/mastra-ai/mastra/pull/22317))

- Fixed trusted instruction loading when the project path uses a filesystem alias, including macOS `/var` and `/private/var`. Review sessions keep reading AGENTS.md and CLAUDE.md from the trusted git ref instead of accidentally falling back to checkout content. Untrusted sessions without a trusted base ref still disable checkout instructions; normal trusted sessions continue reading project instructions. ([#23554](https://github.com/mastra-ai/mastra/pull/23554))

- Kimi For Coding models now report `kimi-for-coding` as their provider (instead of `anthropic.messages`) so message history compatibility can tell Kimi turns apart from Anthropic turns when a thread switches between them. No action is required — the value only feeds Mastra's internal provider-stamping and compatibility logic. Turns persisted before this change keep the old `anthropic.messages` stamp and stay indistinguishable from Anthropic turns; they are left as-is. ([#23695](https://github.com/mastra-ai/mastra/pull/23695))

- `/prune vacuum` no longer compacts local libSQL databases that carry a `libsql_vector_idx` vector index. Any VACUUM over such a database deterministically corrupts its `libsql_vector_meta_shadow` table — silently at first, since vector queries keep returning rows — and compounds over repeated runs until `REINDEX` can no longer repair it. Databases are now detected by schema (not filename), skipped rather than compacted, and reported in `/prune` output with the reason, so the skip is never silent. Detection fails closed: a database whose schema cannot be inspected is left untouched instead of vacuumed. Ordinary databases are still compacted as before. ([#23645](https://github.com/mastra-ai/mastra/pull/23645))

- Bump smol-toml to 1.8.0 for a High severity dependency fix (SEC-170/171). ([#23665](https://github.com/mastra-ai/mastra/pull/23665))

- Updated dependencies [[`d9ef543`](https://github.com/mastra-ai/mastra/commit/d9ef54303b7f050f4e364701c3821fc61e7002f2), [`b96744d`](https://github.com/mastra-ai/mastra/commit/b96744daad8c6e181f03fdf38c732206ded428a2), [`ad5ac69`](https://github.com/mastra-ai/mastra/commit/ad5ac69bcd037bfb85c3399d8b39d9364931ad1b), [`e86be03`](https://github.com/mastra-ai/mastra/commit/e86be034c017fca7deae7d1ebb34d36413928cb8), [`492c0ae`](https://github.com/mastra-ai/mastra/commit/492c0aedcee3fde9555111a660b6c975c160a0db), [`0f4d9cf`](https://github.com/mastra-ai/mastra/commit/0f4d9cf79b49b6dc6a484a0b2d1cf381eb2343a6), [`50e2658`](https://github.com/mastra-ai/mastra/commit/50e2658cdcdc55a14abde08610a8e2b12fdf67a4), [`a0aa698`](https://github.com/mastra-ai/mastra/commit/a0aa698427db9730e39f0c9956d21b97307ab313), [`c3d00db`](https://github.com/mastra-ai/mastra/commit/c3d00db279a95c7dcba0f767704a2bb6544b7b29), [`8510a6d`](https://github.com/mastra-ai/mastra/commit/8510a6d38b9d211af7d94b7860ab182ce55c39d1), [`8510a6d`](https://github.com/mastra-ai/mastra/commit/8510a6d38b9d211af7d94b7860ab182ce55c39d1), [`8510a6d`](https://github.com/mastra-ai/mastra/commit/8510a6d38b9d211af7d94b7860ab182ce55c39d1), [`ddbd352`](https://github.com/mastra-ai/mastra/commit/ddbd3527654a058ed413ae164a1246003dcc9030), [`5eba942`](https://github.com/mastra-ai/mastra/commit/5eba9420330b3f116810891ae14888f7f256cd4f), [`4112ecd`](https://github.com/mastra-ai/mastra/commit/4112ecdec76827384d3a7ab4e8db3ccf90ae7ed1), [`37065ad`](https://github.com/mastra-ai/mastra/commit/37065ad6cd3f74afd16417e8d4e0839c13beca40), [`648dd4f`](https://github.com/mastra-ai/mastra/commit/648dd4f4c4cd330013c0a98f50ffac77fe2ad632), [`91687cb`](https://github.com/mastra-ai/mastra/commit/91687cbdea426e5c6eb0aad895b103082c9b2690), [`2990bcc`](https://github.com/mastra-ai/mastra/commit/2990bccd1c648c8f8614da97fbb459819871f5bc), [`2990bcc`](https://github.com/mastra-ai/mastra/commit/2990bccd1c648c8f8614da97fbb459819871f5bc), [`617c1b3`](https://github.com/mastra-ai/mastra/commit/617c1b30e7e794bbb77feaced1848fde291fc240), [`1ce03b9`](https://github.com/mastra-ai/mastra/commit/1ce03b9c04c633e815bc21cb78c29f7f19851fb2), [`c3d00db`](https://github.com/mastra-ai/mastra/commit/c3d00db279a95c7dcba0f767704a2bb6544b7b29), [`df14b5d`](https://github.com/mastra-ai/mastra/commit/df14b5d12374137db86f92061f8714b28473672e), [`4da756a`](https://github.com/mastra-ai/mastra/commit/4da756a3bcf5f232d9fc0a4dcf184d26366c585e), [`fff3361`](https://github.com/mastra-ai/mastra/commit/fff33614a3376676797cb9b5a5c5b090b026fa0e), [`422e798`](https://github.com/mastra-ai/mastra/commit/422e798ab1a4b14302c5b49fed2f6c818a82706e), [`3fc8c2d`](https://github.com/mastra-ai/mastra/commit/3fc8c2d35f724c3648150b29e50cf61a9360b274), [`ddb3639`](https://github.com/mastra-ai/mastra/commit/ddb3639e3de41f3fe33f68f81c2e5850ff1280b6), [`4b3f587`](https://github.com/mastra-ai/mastra/commit/4b3f587ceabb3f3697c4c1ad4fb154d58002ef7c), [`47868b2`](https://github.com/mastra-ai/mastra/commit/47868b2dde360b038d829c9f88e15061acf3efb5), [`44c20c9`](https://github.com/mastra-ai/mastra/commit/44c20c9a40ba5ef153e1d5d0c413b825e1de42d7), [`502ca89`](https://github.com/mastra-ai/mastra/commit/502ca8904848e77d44622669f2728171d36ad6ca), [`953be88`](https://github.com/mastra-ai/mastra/commit/953be88befd9cdb789b4cfc16680121c663a631b), [`c3d00db`](https://github.com/mastra-ai/mastra/commit/c3d00db279a95c7dcba0f767704a2bb6544b7b29), [`b95aabb`](https://github.com/mastra-ai/mastra/commit/b95aabba261a39b73430d95f3ed051634117d517), [`055057c`](https://github.com/mastra-ai/mastra/commit/055057ca2102e35008fe30871f7c8f422ae25ec2), [`01a6969`](https://github.com/mastra-ai/mastra/commit/01a69695bb69091c7e477d18a84a557d66fb25a9), [`7290151`](https://github.com/mastra-ai/mastra/commit/7290151bdb3bfe518653b0a66a19d6790925e4a0), [`2990bcc`](https://github.com/mastra-ai/mastra/commit/2990bccd1c648c8f8614da97fbb459819871f5bc), [`47868b2`](https://github.com/mastra-ai/mastra/commit/47868b2dde360b038d829c9f88e15061acf3efb5), [`36349ea`](https://github.com/mastra-ai/mastra/commit/36349ea0293c8daa3a3331d6414842f41ffda8ac), [`d3841b9`](https://github.com/mastra-ai/mastra/commit/d3841b96d7e6dc4ec42d9fc8a4000deb34b7f590), [`9bc7895`](https://github.com/mastra-ai/mastra/commit/9bc789591ad683f304c63bd01e554fbba2df9cf6), [`ffe16f1`](https://github.com/mastra-ai/mastra/commit/ffe16f17447449b7155f1f15992e3c9e5f6511ac), [`c3d00db`](https://github.com/mastra-ai/mastra/commit/c3d00db279a95c7dcba0f767704a2bb6544b7b29), [`f466753`](https://github.com/mastra-ai/mastra/commit/f4667539a0c41ae4aa08a4ed380f374687db2592), [`1a59c36`](https://github.com/mastra-ai/mastra/commit/1a59c368249dfd53407e71d931faa4f9e38ab674), [`359c5f8`](https://github.com/mastra-ai/mastra/commit/359c5f8cff989fc5cdd6abaf2c5ca27f97fc2bf3), [`04c11b3`](https://github.com/mastra-ai/mastra/commit/04c11b3cd698fa37af8fad466dc2bf6fa0d5494d), [`502ca89`](https://github.com/mastra-ai/mastra/commit/502ca8904848e77d44622669f2728171d36ad6ca), [`967ab17`](https://github.com/mastra-ai/mastra/commit/967ab179c9814e734af9c3395ff8ef795acbe06c), [`ad5ac69`](https://github.com/mastra-ai/mastra/commit/ad5ac69bcd037bfb85c3399d8b39d9364931ad1b), [`6d20620`](https://github.com/mastra-ai/mastra/commit/6d206205f781cfa2598c2a55123a336909e039b4), [`47868b2`](https://github.com/mastra-ai/mastra/commit/47868b2dde360b038d829c9f88e15061acf3efb5), [`fde3ca5`](https://github.com/mastra-ai/mastra/commit/fde3ca590f7d854ff33354eff4261b907bdacde4), [`3a1d253`](https://github.com/mastra-ai/mastra/commit/3a1d2537ad28754a164aedbf0dd94be224ccb0c3), [`0775cde`](https://github.com/mastra-ai/mastra/commit/0775cdee12b6ad2ad6b5c97874e6248db720224c), [`e3c3e5e`](https://github.com/mastra-ai/mastra/commit/e3c3e5e3e354e88207aa9747f9f0cd3352cea972), [`359c5f8`](https://github.com/mastra-ai/mastra/commit/359c5f8cff989fc5cdd6abaf2c5ca27f97fc2bf3), [`6902f94`](https://github.com/mastra-ai/mastra/commit/6902f940f1879955a90faa0a0ac871667b59d428), [`4ac5da9`](https://github.com/mastra-ai/mastra/commit/4ac5da9d524aa18ec03c135a99e180411155ed2e), [`d55aa61`](https://github.com/mastra-ai/mastra/commit/d55aa616b3e88015c3b74342c75bd510c7e764df), [`7148bf5`](https://github.com/mastra-ai/mastra/commit/7148bf55b147e3fae90b3ba0c9517adb0af5f2a4), [`80608ed`](https://github.com/mastra-ai/mastra/commit/80608ede1a9e5d7d8488ac511245bf327e8987e3), [`e83dfad`](https://github.com/mastra-ai/mastra/commit/e83dfade569ee5aea688de9f2bb8bf8db0a653a7), [`44057ea`](https://github.com/mastra-ai/mastra/commit/44057eac6fd048100574bf71c6dc095f769a6d63), [`40b783b`](https://github.com/mastra-ai/mastra/commit/40b783bb6d8669500d9e6906eac136e3505af14e), [`d581249`](https://github.com/mastra-ai/mastra/commit/d581249a5bf97d32d73e0f1f30cd50ff108e2d67), [`2289456`](https://github.com/mastra-ai/mastra/commit/228945659b2003633e0ebb33e7e34cc2f6efbded), [`6bb122c`](https://github.com/mastra-ai/mastra/commit/6bb122c5147b612c0fe7f173f940933066c4cfcc), [`88f72e5`](https://github.com/mastra-ai/mastra/commit/88f72e51408ece9f80246b0b7c8beba3bee9f631), [`2c501bc`](https://github.com/mastra-ai/mastra/commit/2c501bc8f661b27a06842f1312221efa6125e580), [`990b47f`](https://github.com/mastra-ai/mastra/commit/990b47fa7370753967ea7ce83100a522f79ab328), [`b7b7384`](https://github.com/mastra-ai/mastra/commit/b7b738418757d5763f9f42f44e9ecde136dc5207), [`90846f2`](https://github.com/mastra-ai/mastra/commit/90846f2bfd890de159ab7c3d4fcf8a71c6fb7125), [`6bdb944`](https://github.com/mastra-ai/mastra/commit/6bdb944acb3f39bccad59ee140d7614420948f6b), [`d1b070c`](https://github.com/mastra-ai/mastra/commit/d1b070cd77a944e6bb2e5848052b1e8275be88a2), [`7f6d101`](https://github.com/mastra-ai/mastra/commit/7f6d101044eefc0d776a555b45dbea1c0d5224c4), [`4573c23`](https://github.com/mastra-ai/mastra/commit/4573c231c108e7d796eab12b8e9b2094f8cc4d47), [`4573c23`](https://github.com/mastra-ai/mastra/commit/4573c231c108e7d796eab12b8e9b2094f8cc4d47), [`a54766a`](https://github.com/mastra-ai/mastra/commit/a54766a10381295583144847b856d18e8f924d30), [`1bd31e7`](https://github.com/mastra-ai/mastra/commit/1bd31e7fd49e6de56e6e9a157a6b452cbbd86983), [`a4381a2`](https://github.com/mastra-ai/mastra/commit/a4381a2b36cdb81c4e33c435cd882921edfc146c), [`ff45065`](https://github.com/mastra-ai/mastra/commit/ff45065d42132075c4efb064d96169c4eadbab58), [`e872dd6`](https://github.com/mastra-ai/mastra/commit/e872dd6619f3a5a46f1158b190b02f607b74d191)]:
  - @mastra/core@1.67.0
  - @mastra/agent-browser@0.5.3
  - @mastra/stagehand@0.3.5
  - @mastra/memory@1.30.0
  - @mastra/libsql@1.23.0
  - @mastra/pg@1.25.0
  - @mastra/observability@1.17.8
  - @mastra/mcp@1.18.0
  - @mastra/schema-compat@1.3.10
  - @mastra/duckdb@1.9.0
  - @mastra/github-signals@0.4.1

## 1.7.2-alpha.6

### Patch Changes

- Updated dependencies [[`1a59c36`](https://github.com/mastra-ai/mastra/commit/1a59c368249dfd53407e71d931faa4f9e38ab674), [`a4381a2`](https://github.com/mastra-ai/mastra/commit/a4381a2b36cdb81c4e33c435cd882921edfc146c)]:
  - @mastra/duckdb@1.9.0-alpha.1
  - @mastra/core@1.67.0-alpha.6

## 1.7.2-alpha.5

### Patch Changes

- Forwarded `updateNotificationsStatus` through the lazy notifications storage so the inbox tool's bulk seen-marking reaches the configured store. ([#23718](https://github.com/mastra-ai/mastra/pull/23718))

- Kimi For Coding models now report `kimi-for-coding` as their provider (instead of `anthropic.messages`) so message history compatibility can tell Kimi turns apart from Anthropic turns when a thread switches between them. No action is required — the value only feeds Mastra's internal provider-stamping and compatibility logic. Turns persisted before this change keep the old `anthropic.messages` stamp and stay indistinguishable from Anthropic turns; they are left as-is. ([#23695](https://github.com/mastra-ai/mastra/pull/23695))

- Updated dependencies [[`0f4d9cf`](https://github.com/mastra-ai/mastra/commit/0f4d9cf79b49b6dc6a484a0b2d1cf381eb2343a6), [`50e2658`](https://github.com/mastra-ai/mastra/commit/50e2658cdcdc55a14abde08610a8e2b12fdf67a4), [`8510a6d`](https://github.com/mastra-ai/mastra/commit/8510a6d38b9d211af7d94b7860ab182ce55c39d1), [`8510a6d`](https://github.com/mastra-ai/mastra/commit/8510a6d38b9d211af7d94b7860ab182ce55c39d1), [`8510a6d`](https://github.com/mastra-ai/mastra/commit/8510a6d38b9d211af7d94b7860ab182ce55c39d1), [`5eba942`](https://github.com/mastra-ai/mastra/commit/5eba9420330b3f116810891ae14888f7f256cd4f), [`648dd4f`](https://github.com/mastra-ai/mastra/commit/648dd4f4c4cd330013c0a98f50ffac77fe2ad632), [`3fc8c2d`](https://github.com/mastra-ai/mastra/commit/3fc8c2d35f724c3648150b29e50cf61a9360b274), [`ddb3639`](https://github.com/mastra-ai/mastra/commit/ddb3639e3de41f3fe33f68f81c2e5850ff1280b6), [`502ca89`](https://github.com/mastra-ai/mastra/commit/502ca8904848e77d44622669f2728171d36ad6ca), [`953be88`](https://github.com/mastra-ai/mastra/commit/953be88befd9cdb789b4cfc16680121c663a631b), [`01a6969`](https://github.com/mastra-ai/mastra/commit/01a69695bb69091c7e477d18a84a557d66fb25a9), [`359c5f8`](https://github.com/mastra-ai/mastra/commit/359c5f8cff989fc5cdd6abaf2c5ca27f97fc2bf3), [`502ca89`](https://github.com/mastra-ai/mastra/commit/502ca8904848e77d44622669f2728171d36ad6ca), [`6d20620`](https://github.com/mastra-ai/mastra/commit/6d206205f781cfa2598c2a55123a336909e039b4), [`359c5f8`](https://github.com/mastra-ai/mastra/commit/359c5f8cff989fc5cdd6abaf2c5ca27f97fc2bf3), [`d55aa61`](https://github.com/mastra-ai/mastra/commit/d55aa616b3e88015c3b74342c75bd510c7e764df), [`4573c23`](https://github.com/mastra-ai/mastra/commit/4573c231c108e7d796eab12b8e9b2094f8cc4d47), [`4573c23`](https://github.com/mastra-ai/mastra/commit/4573c231c108e7d796eab12b8e9b2094f8cc4d47)]:
  - @mastra/core@1.67.0-alpha.5
  - @mastra/libsql@1.23.0-alpha.3
  - @mastra/pg@1.25.0-alpha.2
  - @mastra/memory@1.30.0-alpha.4
  - @mastra/duckdb@1.9.0-alpha.0
  - @mastra/github-signals@0.4.1-alpha.0

## 1.7.2-alpha.4

### Patch Changes

- Updated dependencies [[`ad5ac69`](https://github.com/mastra-ai/mastra/commit/ad5ac69bcd037bfb85c3399d8b39d9364931ad1b), [`df14b5d`](https://github.com/mastra-ai/mastra/commit/df14b5d12374137db86f92061f8714b28473672e), [`fff3361`](https://github.com/mastra-ai/mastra/commit/fff33614a3376676797cb9b5a5c5b090b026fa0e), [`d3841b9`](https://github.com/mastra-ai/mastra/commit/d3841b96d7e6dc4ec42d9fc8a4000deb34b7f590), [`ffe16f1`](https://github.com/mastra-ai/mastra/commit/ffe16f17447449b7155f1f15992e3c9e5f6511ac), [`04c11b3`](https://github.com/mastra-ai/mastra/commit/04c11b3cd698fa37af8fad466dc2bf6fa0d5494d), [`ad5ac69`](https://github.com/mastra-ai/mastra/commit/ad5ac69bcd037bfb85c3399d8b39d9364931ad1b), [`e83dfad`](https://github.com/mastra-ai/mastra/commit/e83dfade569ee5aea688de9f2bb8bf8db0a653a7), [`6bb122c`](https://github.com/mastra-ai/mastra/commit/6bb122c5147b612c0fe7f173f940933066c4cfcc), [`88f72e5`](https://github.com/mastra-ai/mastra/commit/88f72e51408ece9f80246b0b7c8beba3bee9f631), [`7f6d101`](https://github.com/mastra-ai/mastra/commit/7f6d101044eefc0d776a555b45dbea1c0d5224c4)]:
  - @mastra/core@1.67.0-alpha.4
  - @mastra/mcp@1.18.0-alpha.1
  - @mastra/schema-compat@1.3.10-alpha.1
  - @mastra/memory@1.30.0-alpha.3

## 1.7.2-alpha.3

### Patch Changes

- Clarified cross-agent peer states, required fresh discovery before sends, bounded expected-reply reminders when a peer becomes unavailable, and added an explicit disconnect tool. Agents can remove a saved connection from the current sender thread with the peer's stable ID: ([#21986](https://github.com/mastra-ai/mastra/pull/21986))

  ```text
  agent_disconnect({ targetId: "code-agent:resource-id:thread-id" })
  ```

- The sandbox-backed workspace filesystem now runs `list_files` tree walks and `grep` searches inside the sandbox in a single command (using `find` and `rg`/`grep`), instead of one round trip per directory and file. `walk()` throws `DirectoryNotFoundError` / `NotDirectoryError` for a missing or non-directory root and reports symlink targets. Ripgrep results are kept when `rg` exits with a per-file error (for example an unreadable file) instead of being discarded, and patterns whose meaning differs between POSIX ERE and JavaScript regex (`[[:digit:]]`, `\<`, `\>`) fall back to the host-side search so match columns stay correct. ([#22317](https://github.com/mastra-ai/mastra/pull/22317))

- `/prune vacuum` no longer compacts local libSQL databases that carry a `libsql_vector_idx` vector index. Any VACUUM over such a database deterministically corrupts its `libsql_vector_meta_shadow` table — silently at first, since vector queries keep returning rows — and compounds over repeated runs until `REINDEX` can no longer repair it. Databases are now detected by schema (not filename), skipped rather than compacted, and reported in `/prune` output with the reason, so the skip is never silent. Detection fails closed: a database whose schema cannot be inspected is left untouched instead of vacuumed. Ordinary databases are still compacted as before. ([#23645](https://github.com/mastra-ai/mastra/pull/23645))

- Bump smol-toml to 1.8.0 for a High severity dependency fix (SEC-170/171). ([#23665](https://github.com/mastra-ai/mastra/pull/23665))

- Updated dependencies [[`492c0ae`](https://github.com/mastra-ai/mastra/commit/492c0aedcee3fde9555111a660b6c975c160a0db), [`ddbd352`](https://github.com/mastra-ai/mastra/commit/ddbd3527654a058ed413ae164a1246003dcc9030), [`4112ecd`](https://github.com/mastra-ai/mastra/commit/4112ecdec76827384d3a7ab4e8db3ccf90ae7ed1), [`617c1b3`](https://github.com/mastra-ai/mastra/commit/617c1b30e7e794bbb77feaced1848fde291fc240), [`422e798`](https://github.com/mastra-ai/mastra/commit/422e798ab1a4b14302c5b49fed2f6c818a82706e), [`47868b2`](https://github.com/mastra-ai/mastra/commit/47868b2dde360b038d829c9f88e15061acf3efb5), [`b95aabb`](https://github.com/mastra-ai/mastra/commit/b95aabba261a39b73430d95f3ed051634117d517), [`055057c`](https://github.com/mastra-ai/mastra/commit/055057ca2102e35008fe30871f7c8f422ae25ec2), [`7290151`](https://github.com/mastra-ai/mastra/commit/7290151bdb3bfe518653b0a66a19d6790925e4a0), [`47868b2`](https://github.com/mastra-ai/mastra/commit/47868b2dde360b038d829c9f88e15061acf3efb5), [`9bc7895`](https://github.com/mastra-ai/mastra/commit/9bc789591ad683f304c63bd01e554fbba2df9cf6), [`47868b2`](https://github.com/mastra-ai/mastra/commit/47868b2dde360b038d829c9f88e15061acf3efb5), [`6902f94`](https://github.com/mastra-ai/mastra/commit/6902f940f1879955a90faa0a0ac871667b59d428), [`7148bf5`](https://github.com/mastra-ai/mastra/commit/7148bf55b147e3fae90b3ba0c9517adb0af5f2a4), [`40b783b`](https://github.com/mastra-ai/mastra/commit/40b783bb6d8669500d9e6906eac136e3505af14e), [`6bdb944`](https://github.com/mastra-ai/mastra/commit/6bdb944acb3f39bccad59ee140d7614420948f6b), [`a54766a`](https://github.com/mastra-ai/mastra/commit/a54766a10381295583144847b856d18e8f924d30), [`ff45065`](https://github.com/mastra-ai/mastra/commit/ff45065d42132075c4efb064d96169c4eadbab58)]:
  - @mastra/core@1.67.0-alpha.3
  - @mastra/libsql@1.23.0-alpha.2
  - @mastra/observability@1.17.8-alpha.1
  - @mastra/mcp@1.17.4-alpha.0

## 1.7.2-alpha.2

### Patch Changes

- Updated dependencies [[`a0aa698`](https://github.com/mastra-ai/mastra/commit/a0aa698427db9730e39f0c9956d21b97307ab313), [`c3d00db`](https://github.com/mastra-ai/mastra/commit/c3d00db279a95c7dcba0f767704a2bb6544b7b29), [`c3d00db`](https://github.com/mastra-ai/mastra/commit/c3d00db279a95c7dcba0f767704a2bb6544b7b29), [`44c20c9`](https://github.com/mastra-ai/mastra/commit/44c20c9a40ba5ef153e1d5d0c413b825e1de42d7), [`c3d00db`](https://github.com/mastra-ai/mastra/commit/c3d00db279a95c7dcba0f767704a2bb6544b7b29), [`36349ea`](https://github.com/mastra-ai/mastra/commit/36349ea0293c8daa3a3331d6414842f41ffda8ac), [`c3d00db`](https://github.com/mastra-ai/mastra/commit/c3d00db279a95c7dcba0f767704a2bb6544b7b29), [`f466753`](https://github.com/mastra-ai/mastra/commit/f4667539a0c41ae4aa08a4ed380f374687db2592), [`e3c3e5e`](https://github.com/mastra-ai/mastra/commit/e3c3e5e3e354e88207aa9747f9f0cd3352cea972), [`d581249`](https://github.com/mastra-ai/mastra/commit/d581249a5bf97d32d73e0f1f30cd50ff108e2d67), [`990b47f`](https://github.com/mastra-ai/mastra/commit/990b47fa7370753967ea7ce83100a522f79ab328), [`b7b7384`](https://github.com/mastra-ai/mastra/commit/b7b738418757d5763f9f42f44e9ecde136dc5207), [`e872dd6`](https://github.com/mastra-ai/mastra/commit/e872dd6619f3a5a46f1158b190b02f607b74d191)]:
  - @mastra/agent-browser@0.5.3-alpha.0
  - @mastra/stagehand@0.3.5-alpha.0
  - @mastra/core@1.67.0-alpha.2
  - @mastra/memory@1.30.0-alpha.2
  - @mastra/observability@1.17.8-alpha.0
  - @mastra/libsql@1.23.0-alpha.1
  - @mastra/mcp@1.17.4-alpha.0
  - @mastra/pg@1.25.0-alpha.1

## 1.7.2-alpha.1

### Patch Changes

- Fix Bedrock prompt caching to enable by default for all cache-capable Claude models. ([#23556](https://github.com/mastra-ai/mastra/pull/23556))

  The gate now enumerates the closed set of legacy Claude 3.x models that support caching and defaults every newer Anthropic family on, instead of matching an allow-list of current model IDs. The old allow-list was permanently behind — newly released cache-capable models were silently billed at full input rate (~10x the cached cost) until their IDs were manually appended.

  - Claude 4+ and all named families (opus-5, sonnet-5, fable, mythos, and future families) now cache without a code change.
  - `claude-3-5-sonnet-20240620` and non-Anthropic models remain correctly excluded.

  Fixes #23552.

- Fixed trusted instruction loading when the project path uses a filesystem alias, including macOS `/var` and `/private/var`. Review sessions keep reading AGENTS.md and CLAUDE.md from the trusted git ref instead of accidentally falling back to checkout content. Untrusted sessions without a trusted base ref still disable checkout instructions; normal trusted sessions continue reading project instructions. ([#23554](https://github.com/mastra-ai/mastra/pull/23554))

- Updated dependencies [[`d9ef543`](https://github.com/mastra-ai/mastra/commit/d9ef54303b7f050f4e364701c3821fc61e7002f2), [`b96744d`](https://github.com/mastra-ai/mastra/commit/b96744daad8c6e181f03fdf38c732206ded428a2), [`37065ad`](https://github.com/mastra-ai/mastra/commit/37065ad6cd3f74afd16417e8d4e0839c13beca40), [`91687cb`](https://github.com/mastra-ai/mastra/commit/91687cbdea426e5c6eb0aad895b103082c9b2690), [`2990bcc`](https://github.com/mastra-ai/mastra/commit/2990bccd1c648c8f8614da97fbb459819871f5bc), [`2990bcc`](https://github.com/mastra-ai/mastra/commit/2990bccd1c648c8f8614da97fbb459819871f5bc), [`1ce03b9`](https://github.com/mastra-ai/mastra/commit/1ce03b9c04c633e815bc21cb78c29f7f19851fb2), [`2990bcc`](https://github.com/mastra-ai/mastra/commit/2990bccd1c648c8f8614da97fbb459819871f5bc), [`967ab17`](https://github.com/mastra-ai/mastra/commit/967ab179c9814e734af9c3395ff8ef795acbe06c), [`fde3ca5`](https://github.com/mastra-ai/mastra/commit/fde3ca590f7d854ff33354eff4261b907bdacde4), [`0775cde`](https://github.com/mastra-ai/mastra/commit/0775cdee12b6ad2ad6b5c97874e6248db720224c), [`80608ed`](https://github.com/mastra-ai/mastra/commit/80608ede1a9e5d7d8488ac511245bf327e8987e3), [`44057ea`](https://github.com/mastra-ai/mastra/commit/44057eac6fd048100574bf71c6dc095f769a6d63), [`2289456`](https://github.com/mastra-ai/mastra/commit/228945659b2003633e0ebb33e7e34cc2f6efbded), [`90846f2`](https://github.com/mastra-ai/mastra/commit/90846f2bfd890de159ab7c3d4fcf8a71c6fb7125), [`d1b070c`](https://github.com/mastra-ai/mastra/commit/d1b070cd77a944e6bb2e5848052b1e8275be88a2), [`1bd31e7`](https://github.com/mastra-ai/mastra/commit/1bd31e7fd49e6de56e6e9a157a6b452cbbd86983)]:
  - @mastra/core@1.67.0-alpha.1
  - @mastra/memory@1.30.0-alpha.1
  - @mastra/libsql@1.22.6-alpha.0
  - @mastra/pg@1.24.1-alpha.0
  - @mastra/schema-compat@1.3.10-alpha.0
  - @mastra/mcp@1.17.3

## 1.7.2-alpha.0

### Patch Changes

- Updated dependencies [[`e86be03`](https://github.com/mastra-ai/mastra/commit/e86be034c017fca7deae7d1ebb34d36413928cb8), [`4da756a`](https://github.com/mastra-ai/mastra/commit/4da756a3bcf5f232d9fc0a4dcf184d26366c585e), [`4b3f587`](https://github.com/mastra-ai/mastra/commit/4b3f587ceabb3f3697c4c1ad4fb154d58002ef7c), [`3a1d253`](https://github.com/mastra-ai/mastra/commit/3a1d2537ad28754a164aedbf0dd94be224ccb0c3), [`4ac5da9`](https://github.com/mastra-ai/mastra/commit/4ac5da9d524aa18ec03c135a99e180411155ed2e), [`2c501bc`](https://github.com/mastra-ai/mastra/commit/2c501bc8f661b27a06842f1312221efa6125e580)]:
  - @mastra/core@1.66.1-alpha.0
  - @mastra/memory@1.29.1-alpha.0

## 1.7.1

### Patch Changes

- Added configurable commit co-author attribution with per-field defaults ([#23495](https://github.com/mastra-ai/mastra/pull/23495))

- Use the Mastra Platform bot for default coding-agent commit attribution. ([#23418](https://github.com/mastra-ai/mastra/pull/23418))

- Upgraded `@libsql/client` to 0.18.0 so in-memory SQLite databases keep their tables across write transactions. ([#23164](https://github.com/mastra-ai/mastra/pull/23164))

- Updated dependencies [[`7eda39b`](https://github.com/mastra-ai/mastra/commit/7eda39bd17356b9985ae44e663ccde30ff0fedea), [`bb09e86`](https://github.com/mastra-ai/mastra/commit/bb09e860dd6c510365f0d7ab068b194707e99fa4), [`4cbb201`](https://github.com/mastra-ai/mastra/commit/4cbb201261df30574a98c241615cd096d9f223f3), [`bb09e86`](https://github.com/mastra-ai/mastra/commit/bb09e860dd6c510365f0d7ab068b194707e99fa4), [`bb09e86`](https://github.com/mastra-ai/mastra/commit/bb09e860dd6c510365f0d7ab068b194707e99fa4), [`cf9cd79`](https://github.com/mastra-ai/mastra/commit/cf9cd7963c664c7e9bcebe41fe7e492d1557ff6f), [`f3d9aae`](https://github.com/mastra-ai/mastra/commit/f3d9aae7bb5324c9dc7abc7caa166595f7582190), [`0d56f39`](https://github.com/mastra-ai/mastra/commit/0d56f398f08a1527eff72de4c0b66f74606b17d6), [`4d72bce`](https://github.com/mastra-ai/mastra/commit/4d72bceaf323dfe617a882b80defb2ab21b97ed9), [`44a6da9`](https://github.com/mastra-ai/mastra/commit/44a6da9cd61b7767a73c66da42ab1eca4073cd42), [`4d72bce`](https://github.com/mastra-ai/mastra/commit/4d72bceaf323dfe617a882b80defb2ab21b97ed9), [`1e1fe34`](https://github.com/mastra-ai/mastra/commit/1e1fe3483102459e6ec9da096756b4efb12f5221), [`4fbbdf1`](https://github.com/mastra-ai/mastra/commit/4fbbdf1ba4ee8a900aedceb6cda657369bab06ae), [`1fc8225`](https://github.com/mastra-ai/mastra/commit/1fc82255bdca4340a7e0fd42aa61a97359d6c87f), [`67315b1`](https://github.com/mastra-ai/mastra/commit/67315b10f2058a17bfadcb053e49b0d4655bf3bb), [`2efa6ba`](https://github.com/mastra-ai/mastra/commit/2efa6bab6dde4e77e21adf1a9d59e8e44710194b), [`cc91725`](https://github.com/mastra-ai/mastra/commit/cc917251a39b60050b9d8b004f5d281f4a578b75), [`0d56f39`](https://github.com/mastra-ai/mastra/commit/0d56f398f08a1527eff72de4c0b66f74606b17d6), [`0d56f39`](https://github.com/mastra-ai/mastra/commit/0d56f398f08a1527eff72de4c0b66f74606b17d6), [`3da908f`](https://github.com/mastra-ai/mastra/commit/3da908fdf7b80b4e1577aa85cc45f28bb54aebc9), [`d70d0b5`](https://github.com/mastra-ai/mastra/commit/d70d0b5a8326c14d45d934f523f4b07b0eb9b68b), [`ecada83`](https://github.com/mastra-ai/mastra/commit/ecada83c1960b02720dcff6323ce5cd3fc39cbe7), [`7865a79`](https://github.com/mastra-ai/mastra/commit/7865a79253be403bd79a307224c9968d98ea0b72), [`e7df80e`](https://github.com/mastra-ai/mastra/commit/e7df80e4e043c1c63ad81fbb4b6e0716f43c43bd), [`2efa6ba`](https://github.com/mastra-ai/mastra/commit/2efa6bab6dde4e77e21adf1a9d59e8e44710194b), [`1fa24d1`](https://github.com/mastra-ai/mastra/commit/1fa24d1d23bfac997af49fa5a9684b67c8249612), [`9c43765`](https://github.com/mastra-ai/mastra/commit/9c437659d97fe45775ecf3a35e121db15c6405fa), [`de5db60`](https://github.com/mastra-ai/mastra/commit/de5db6055519fd22d1673a2ad90e69d1b45ac54d), [`0096d5c`](https://github.com/mastra-ai/mastra/commit/0096d5c819d058ecc4de645774e4f46b8c122656), [`4d72bce`](https://github.com/mastra-ai/mastra/commit/4d72bceaf323dfe617a882b80defb2ab21b97ed9), [`119d2aa`](https://github.com/mastra-ai/mastra/commit/119d2aaded03df03325fe25b167e71603cd8a2aa), [`2efa6ba`](https://github.com/mastra-ai/mastra/commit/2efa6bab6dde4e77e21adf1a9d59e8e44710194b), [`50c588e`](https://github.com/mastra-ai/mastra/commit/50c588ebe5e3fe407efe3a36e46c380a9d2492fb), [`3083d64`](https://github.com/mastra-ai/mastra/commit/3083d644b85df75bed88411f610146b5250d580f), [`de5db60`](https://github.com/mastra-ai/mastra/commit/de5db6055519fd22d1673a2ad90e69d1b45ac54d), [`7865a79`](https://github.com/mastra-ai/mastra/commit/7865a79253be403bd79a307224c9968d98ea0b72), [`de5db60`](https://github.com/mastra-ai/mastra/commit/de5db6055519fd22d1673a2ad90e69d1b45ac54d), [`0665591`](https://github.com/mastra-ai/mastra/commit/0665591362ea8f9300b43920b0e810389b8e5438), [`8fb01c3`](https://github.com/mastra-ai/mastra/commit/8fb01c3ef5a4b2e2d2ac5099f19f663c7e7a382c), [`1e1fe34`](https://github.com/mastra-ai/mastra/commit/1e1fe3483102459e6ec9da096756b4efb12f5221)]:
  - @mastra/core@1.66.0
  - @mastra/pg@1.24.0
  - @mastra/duckdb@1.8.0
  - @mastra/memory@1.29.0
  - @mastra/libsql@1.22.5
  - @mastra/observability@1.17.7
  - @mastra/mcp@1.17.3

## 1.7.1-alpha.4

### Patch Changes

- Updated dependencies [[`cf9cd79`](https://github.com/mastra-ai/mastra/commit/cf9cd7963c664c7e9bcebe41fe7e492d1557ff6f), [`0d56f39`](https://github.com/mastra-ai/mastra/commit/0d56f398f08a1527eff72de4c0b66f74606b17d6), [`0d56f39`](https://github.com/mastra-ai/mastra/commit/0d56f398f08a1527eff72de4c0b66f74606b17d6), [`0d56f39`](https://github.com/mastra-ai/mastra/commit/0d56f398f08a1527eff72de4c0b66f74606b17d6), [`3da908f`](https://github.com/mastra-ai/mastra/commit/3da908fdf7b80b4e1577aa85cc45f28bb54aebc9), [`0096d5c`](https://github.com/mastra-ai/mastra/commit/0096d5c819d058ecc4de645774e4f46b8c122656), [`119d2aa`](https://github.com/mastra-ai/mastra/commit/119d2aaded03df03325fe25b167e71603cd8a2aa)]:
  - @mastra/core@1.66.0-alpha.4
  - @mastra/duckdb@1.8.0-alpha.2
  - @mastra/pg@1.24.0-alpha.3

## 1.7.1-alpha.3

### Patch Changes

- Added configurable commit co-author attribution with per-field defaults ([#23495](https://github.com/mastra-ai/mastra/pull/23495))

- Updated dependencies [[`4cbb201`](https://github.com/mastra-ai/mastra/commit/4cbb201261df30574a98c241615cd096d9f223f3), [`44a6da9`](https://github.com/mastra-ai/mastra/commit/44a6da9cd61b7767a73c66da42ab1eca4073cd42), [`1e1fe34`](https://github.com/mastra-ai/mastra/commit/1e1fe3483102459e6ec9da096756b4efb12f5221), [`67315b1`](https://github.com/mastra-ai/mastra/commit/67315b10f2058a17bfadcb053e49b0d4655bf3bb), [`cc91725`](https://github.com/mastra-ai/mastra/commit/cc917251a39b60050b9d8b004f5d281f4a578b75), [`50c588e`](https://github.com/mastra-ai/mastra/commit/50c588ebe5e3fe407efe3a36e46c380a9d2492fb), [`3083d64`](https://github.com/mastra-ai/mastra/commit/3083d644b85df75bed88411f610146b5250d580f), [`1e1fe34`](https://github.com/mastra-ai/mastra/commit/1e1fe3483102459e6ec9da096756b4efb12f5221)]:
  - @mastra/core@1.66.0-alpha.3
  - @mastra/memory@1.29.0-alpha.2
  - @mastra/observability@1.17.7-alpha.0
  - @mastra/mcp@1.17.3

## 1.7.1-alpha.2

### Patch Changes

- Updated dependencies [[`4d72bce`](https://github.com/mastra-ai/mastra/commit/4d72bceaf323dfe617a882b80defb2ab21b97ed9), [`4d72bce`](https://github.com/mastra-ai/mastra/commit/4d72bceaf323dfe617a882b80defb2ab21b97ed9), [`1fc8225`](https://github.com/mastra-ai/mastra/commit/1fc82255bdca4340a7e0fd42aa61a97359d6c87f), [`4d72bce`](https://github.com/mastra-ai/mastra/commit/4d72bceaf323dfe617a882b80defb2ab21b97ed9)]:
  - @mastra/core@1.66.0-alpha.2
  - @mastra/pg@1.24.0-alpha.2
  - @mastra/duckdb@1.8.0-alpha.1

## 1.7.1-alpha.1

### Patch Changes

- Updated dependencies [[`bb09e86`](https://github.com/mastra-ai/mastra/commit/bb09e860dd6c510365f0d7ab068b194707e99fa4), [`bb09e86`](https://github.com/mastra-ai/mastra/commit/bb09e860dd6c510365f0d7ab068b194707e99fa4), [`bb09e86`](https://github.com/mastra-ai/mastra/commit/bb09e860dd6c510365f0d7ab068b194707e99fa4), [`4fbbdf1`](https://github.com/mastra-ai/mastra/commit/4fbbdf1ba4ee8a900aedceb6cda657369bab06ae), [`2efa6ba`](https://github.com/mastra-ai/mastra/commit/2efa6bab6dde4e77e21adf1a9d59e8e44710194b), [`7865a79`](https://github.com/mastra-ai/mastra/commit/7865a79253be403bd79a307224c9968d98ea0b72), [`2efa6ba`](https://github.com/mastra-ai/mastra/commit/2efa6bab6dde4e77e21adf1a9d59e8e44710194b), [`de5db60`](https://github.com/mastra-ai/mastra/commit/de5db6055519fd22d1673a2ad90e69d1b45ac54d), [`2efa6ba`](https://github.com/mastra-ai/mastra/commit/2efa6bab6dde4e77e21adf1a9d59e8e44710194b), [`de5db60`](https://github.com/mastra-ai/mastra/commit/de5db6055519fd22d1673a2ad90e69d1b45ac54d), [`7865a79`](https://github.com/mastra-ai/mastra/commit/7865a79253be403bd79a307224c9968d98ea0b72), [`de5db60`](https://github.com/mastra-ai/mastra/commit/de5db6055519fd22d1673a2ad90e69d1b45ac54d)]:
  - @mastra/core@1.66.0-alpha.1
  - @mastra/pg@1.24.0-alpha.1
  - @mastra/duckdb@1.8.0-alpha.0
  - @mastra/memory@1.29.0-alpha.1
  - @mastra/libsql@1.22.5-alpha.1

## 1.7.1-alpha.0

### Patch Changes

- Use the Mastra Platform bot for default coding-agent commit attribution. ([#23418](https://github.com/mastra-ai/mastra/pull/23418))

- Upgraded `@libsql/client` to 0.18.0 so in-memory SQLite databases keep their tables across write transactions. ([#23164](https://github.com/mastra-ai/mastra/pull/23164))

- Updated dependencies [[`7eda39b`](https://github.com/mastra-ai/mastra/commit/7eda39bd17356b9985ae44e663ccde30ff0fedea), [`f3d9aae`](https://github.com/mastra-ai/mastra/commit/f3d9aae7bb5324c9dc7abc7caa166595f7582190), [`d70d0b5`](https://github.com/mastra-ai/mastra/commit/d70d0b5a8326c14d45d934f523f4b07b0eb9b68b), [`ecada83`](https://github.com/mastra-ai/mastra/commit/ecada83c1960b02720dcff6323ce5cd3fc39cbe7), [`e7df80e`](https://github.com/mastra-ai/mastra/commit/e7df80e4e043c1c63ad81fbb4b6e0716f43c43bd), [`1fa24d1`](https://github.com/mastra-ai/mastra/commit/1fa24d1d23bfac997af49fa5a9684b67c8249612), [`9c43765`](https://github.com/mastra-ai/mastra/commit/9c437659d97fe45775ecf3a35e121db15c6405fa), [`0665591`](https://github.com/mastra-ai/mastra/commit/0665591362ea8f9300b43920b0e810389b8e5438), [`8fb01c3`](https://github.com/mastra-ai/mastra/commit/8fb01c3ef5a4b2e2d2ac5099f19f663c7e7a382c)]:
  - @mastra/core@1.66.0-alpha.0
  - @mastra/memory@1.29.0-alpha.0
  - @mastra/pg@1.23.1-alpha.0
  - @mastra/libsql@1.22.5-alpha.0

## 1.7.0

### Minor Changes

- Added explicit project-level MCP enable overrides so a project can opt into a server that is disabled globally. MCP statuses expose the global default and all-server kill-switch state so clients can explain the effective setting. The global all-server kill switch remains absolute. ([#23255](https://github.com/mastra-ai/mastra/pull/23255))

  ```ts
  await mcpManager.setServerDisabled('notion', false);
  await mcpManager.inheritServer('notion');
  ```

- Added host-provided session instructions so workspace-free agent sessions can receive purpose-specific guidance. ([#23001](https://github.com/mastra-ai/mastra/pull/23001))

  ```ts
  createMastraCodeAgentController({
    hostInstructions: 'Help operators inspect and repair Factory state.',
  });
  ```

### Patch Changes

- Enabled Amazon Bedrock prompt caching for Claude Opus 5 models. ([#23092](https://github.com/mastra-ai/mastra/pull/23092))

- Added a persisted preference for Mastra Code interfaces to opt into native subagents. ([#23335](https://github.com/mastra-ai/mastra/pull/23335))

- Fixed Windows file references in custom slash commands, including `@src\context.md`, ([#21632](https://github.com/mastra-ai/mastra/pull/21632))
  `@C:\path\to\file`, and `@C:/path/to/file`. Spaces, quoted paths, and glob patterns
  are not supported.

- Read `/knowledge` from the same scope the Subconscious writes under. The knowledge browser was building its org rung from the session owner id (a user id), while local curation writes under the fixed `local` org, so the browser always looked at an empty scope. Both the memory factory and the inspector now derive their org/resource rungs from one resolver, and the local org id is exported as `LOCAL_KNOWLEDGE_ORG_ID`. Factory sessions keep failing closed when their org is unresolved. ([#22944](https://github.com/mastra-ai/mastra/pull/22944))

- Restore the default explore, plan, and execute subagents in Mastra Code while preserving explicit empty and custom subagent configurations. Match delegation prompt guidance to tool availability and permissions. ([#23217](https://github.com/mastra-ai/mastra/pull/23217))

- Stop advertising Bedrock models that cannot be served over Converse. Nine `bedrock-mantle` entries in the models.dev catalog carry a `provider` override pointing at a different endpoint and API shape, but every catalog id is handed to `createAmazonBedrock()`, so they appeared in the `/models` picker and in packs while being unreachable. They are now filtered out of the advertised catalog. ([#23061](https://github.com/mastra-ai/mastra/pull/23061))

- Improved the agent's guidance for memory tools. ([#23039](https://github.com/mastra-ai/mastra/pull/23039))

- Updated dependencies [[`fce0b9f`](https://github.com/mastra-ai/mastra/commit/fce0b9f1c3991acdb7ec7c9ada78bc39762319c1), [`b72c747`](https://github.com/mastra-ai/mastra/commit/b72c747a1a698c829c7c1d42e75f72c6d1808dde), [`e4852fc`](https://github.com/mastra-ai/mastra/commit/e4852fc42fc9e72559370dfa9b0e3f20ccf9012e), [`89f2486`](https://github.com/mastra-ai/mastra/commit/89f2486028ce25c5db19d1f361d5f65cd3ff93e5), [`d7bd6f7`](https://github.com/mastra-ai/mastra/commit/d7bd6f7a91daf528f34d628faede4a916421b0dd), [`e4852fc`](https://github.com/mastra-ai/mastra/commit/e4852fc42fc9e72559370dfa9b0e3f20ccf9012e), [`917da71`](https://github.com/mastra-ai/mastra/commit/917da711580cdc9e8f7ca474b301f3611a5c46ed), [`51b2b5e`](https://github.com/mastra-ai/mastra/commit/51b2b5e0ca9ba4a23fc6544246ad9822c4dbd92e), [`ae375e6`](https://github.com/mastra-ai/mastra/commit/ae375e6799af20820d90e30f63a084ba1507b771), [`b5a1a42`](https://github.com/mastra-ai/mastra/commit/b5a1a42763b891c54d7027b916622d45f95f86b9), [`1778103`](https://github.com/mastra-ai/mastra/commit/17781034204a151a1ff910e9d11d21effe22a9e0), [`40f3647`](https://github.com/mastra-ai/mastra/commit/40f36478291d6098f762fc639d545357732b77b4), [`2911c88`](https://github.com/mastra-ai/mastra/commit/2911c88c9226f5ab969abc3a90b161c1c1cbd19e), [`66029df`](https://github.com/mastra-ai/mastra/commit/66029dfccb8f5d69f26d8df920647b34a0a763d1), [`eef3409`](https://github.com/mastra-ai/mastra/commit/eef3409c125dcd9765e4a85d17f10c53892f6f2c), [`db7cc1c`](https://github.com/mastra-ai/mastra/commit/db7cc1c5d8cd1650c41c57590c25ab86c9e5032f), [`abb0263`](https://github.com/mastra-ai/mastra/commit/abb0263bc5740868dd9b3b615312a0b9e040747f), [`e4852fc`](https://github.com/mastra-ai/mastra/commit/e4852fc42fc9e72559370dfa9b0e3f20ccf9012e), [`0ea8af0`](https://github.com/mastra-ai/mastra/commit/0ea8af012ba2fe1431c93697399d7643f09c073d), [`8ff274c`](https://github.com/mastra-ai/mastra/commit/8ff274c2ffea84a910c5d6ce93dd6d3c048f8082), [`2234952`](https://github.com/mastra-ai/mastra/commit/2234952ca8b1f28cfe2f66278ef0ac156ca21a70), [`f649ea0`](https://github.com/mastra-ai/mastra/commit/f649ea0f006436e7268c3b0fa45f9865a02130cc), [`54adc91`](https://github.com/mastra-ai/mastra/commit/54adc9164beee68798adff0bfb0ebae4dada1af0), [`2801d26`](https://github.com/mastra-ai/mastra/commit/2801d26b69bbe8929d302abd09619a68b4cc0d98), [`6a05d36`](https://github.com/mastra-ai/mastra/commit/6a05d36a0bb28390539cfc5a4f12c847474d28d2), [`94e0bef`](https://github.com/mastra-ai/mastra/commit/94e0bef38f8ee48e6599dddc6040fcb2b7fb09a7), [`f596ff6`](https://github.com/mastra-ai/mastra/commit/f596ff65378fcc7e85fb314d895a38fb2e5b7e7e), [`6a05d36`](https://github.com/mastra-ai/mastra/commit/6a05d36a0bb28390539cfc5a4f12c847474d28d2), [`e3e847e`](https://github.com/mastra-ai/mastra/commit/e3e847e32238fa52c0295f57fd04f695d400779d), [`2801d26`](https://github.com/mastra-ai/mastra/commit/2801d26b69bbe8929d302abd09619a68b4cc0d98), [`2801d26`](https://github.com/mastra-ai/mastra/commit/2801d26b69bbe8929d302abd09619a68b4cc0d98), [`c9b21f3`](https://github.com/mastra-ai/mastra/commit/c9b21f39792f892c91e616a67f9cfb19ddaa8046), [`c4a844e`](https://github.com/mastra-ai/mastra/commit/c4a844ef00ef99a5532cbd4d7e20a5f243703c2c), [`88abfbf`](https://github.com/mastra-ai/mastra/commit/88abfbf5fb256e0b5602aafa6e733192f9a4236a), [`7f107dd`](https://github.com/mastra-ai/mastra/commit/7f107dd68c9d1d3906cb31db7fcd222991281b5b), [`e243fec`](https://github.com/mastra-ai/mastra/commit/e243feca17207d1545ff9776e8fff635b0ff4189), [`c66e628`](https://github.com/mastra-ai/mastra/commit/c66e6284421eabaca23029c2089a070ffd914678), [`6827484`](https://github.com/mastra-ai/mastra/commit/6827484382bb2a4d0781ed9c76a432cdbd75e50a), [`18d99e7`](https://github.com/mastra-ai/mastra/commit/18d99e7b5687ea6a1cdb601fa5c4209a03b97c02), [`b1227c0`](https://github.com/mastra-ai/mastra/commit/b1227c0604be8c33dd02705fe6978df70c32f87d), [`ce2f341`](https://github.com/mastra-ai/mastra/commit/ce2f34171a8e1eee428219670a0a7897083c91e3), [`0c62271`](https://github.com/mastra-ai/mastra/commit/0c622712c3e62fb3108ec6090f2187df38666437), [`4337eb6`](https://github.com/mastra-ai/mastra/commit/4337eb6230681b791ec1ad56e58af9fb8329a5ce), [`4362001`](https://github.com/mastra-ai/mastra/commit/436200145bf70d825918e60f6dbdd2389a749e48), [`ffc6440`](https://github.com/mastra-ai/mastra/commit/ffc6440d13b9392b3cf1ff309d3b9cde4a791038), [`a0ad935`](https://github.com/mastra-ai/mastra/commit/a0ad9351eaf8527d1515051ddf3998ee258b9acd), [`e4852fc`](https://github.com/mastra-ai/mastra/commit/e4852fc42fc9e72559370dfa9b0e3f20ccf9012e), [`cd71bd3`](https://github.com/mastra-ai/mastra/commit/cd71bd3beb8afe08a106d1e29efee387ffb74cd1), [`a5f22f4`](https://github.com/mastra-ai/mastra/commit/a5f22f4ff1763ab9679391a6a9118358c8059e11), [`5901b59`](https://github.com/mastra-ai/mastra/commit/5901b5920a08f1869092e5e4cccf8a0be17781e9), [`8c96b5c`](https://github.com/mastra-ai/mastra/commit/8c96b5c6a3c55d4665ee8dd4f9c55bb14e8e1dd3), [`db7cc1c`](https://github.com/mastra-ai/mastra/commit/db7cc1c5d8cd1650c41c57590c25ab86c9e5032f), [`f31c3fa`](https://github.com/mastra-ai/mastra/commit/f31c3fae16a0710f9e52dba9bccc0018f9da2ac1), [`9d647e2`](https://github.com/mastra-ai/mastra/commit/9d647e25b51cd246ef974d9cad6b05dfdd37126e), [`e5a8e80`](https://github.com/mastra-ai/mastra/commit/e5a8e80caef6aaa00495de9e00d11f06c4a78bdb), [`64db1b3`](https://github.com/mastra-ai/mastra/commit/64db1b313bdb02e063019fdcbb8d28608858ae71)]:
  - @mastra/memory@1.28.3
  - @mastra/core@1.65.0
  - @mastra/libsql@1.22.4
  - @mastra/observability@1.17.6
  - @mastra/schema-compat@1.3.9
  - @mastra/pg@1.23.0
  - @mastra/duckdb@1.7.0
  - @mastra/mcp@1.17.3

## 1.7.0-alpha.16

### Minor Changes

- Added explicit project-level MCP enable overrides so a project can opt into a server that is disabled globally. MCP statuses expose the global default and all-server kill-switch state so clients can explain the effective setting. The global all-server kill switch remains absolute. ([#23255](https://github.com/mastra-ai/mastra/pull/23255))

  ```ts
  await mcpManager.setServerDisabled('notion', false);
  await mcpManager.inheritServer('notion');
  ```

## 1.7.0-alpha.15

### Patch Changes

- Updated dependencies [[`0ea8af0`](https://github.com/mastra-ai/mastra/commit/0ea8af012ba2fe1431c93697399d7643f09c073d), [`2234952`](https://github.com/mastra-ai/mastra/commit/2234952ca8b1f28cfe2f66278ef0ac156ca21a70)]:
  - @mastra/core@1.65.0-alpha.12
  - @mastra/pg@1.23.0-alpha.7

## 1.7.0-alpha.14

### Patch Changes

- Updated dependencies [[`b5a1a42`](https://github.com/mastra-ai/mastra/commit/b5a1a42763b891c54d7027b916622d45f95f86b9), [`40f3647`](https://github.com/mastra-ai/mastra/commit/40f36478291d6098f762fc639d545357732b77b4), [`8ff274c`](https://github.com/mastra-ai/mastra/commit/8ff274c2ffea84a910c5d6ce93dd6d3c048f8082), [`94e0bef`](https://github.com/mastra-ai/mastra/commit/94e0bef38f8ee48e6599dddc6040fcb2b7fb09a7), [`c4a844e`](https://github.com/mastra-ai/mastra/commit/c4a844ef00ef99a5532cbd4d7e20a5f243703c2c), [`e243fec`](https://github.com/mastra-ai/mastra/commit/e243feca17207d1545ff9776e8fff635b0ff4189), [`cd71bd3`](https://github.com/mastra-ai/mastra/commit/cd71bd3beb8afe08a106d1e29efee387ffb74cd1)]:
  - @mastra/core@1.65.0-alpha.11
  - @mastra/schema-compat@1.3.9-alpha.0
  - @mastra/pg@1.23.0-alpha.6
  - @mastra/observability@1.17.6-alpha.2
  - @mastra/libsql@1.22.4-alpha.1
  - @mastra/mcp@1.17.3
  - @mastra/memory@1.28.3-alpha.4

## 1.7.0-alpha.13

### Patch Changes

- Added a persisted preference for Mastra Code interfaces to opt into native subagents. ([#23335](https://github.com/mastra-ai/mastra/pull/23335))

## 1.7.0-alpha.12

### Patch Changes

- Updated dependencies [[`e3e847e`](https://github.com/mastra-ai/mastra/commit/e3e847e32238fa52c0295f57fd04f695d400779d)]:
  - @mastra/pg@1.23.0-alpha.5

## 1.7.0-alpha.11

### Patch Changes

- Updated dependencies [[`d7bd6f7`](https://github.com/mastra-ai/mastra/commit/d7bd6f7a91daf528f34d628faede4a916421b0dd), [`f596ff6`](https://github.com/mastra-ai/mastra/commit/f596ff65378fcc7e85fb314d895a38fb2e5b7e7e), [`4337eb6`](https://github.com/mastra-ai/mastra/commit/4337eb6230681b791ec1ad56e58af9fb8329a5ce)]:
  - @mastra/core@1.65.0-alpha.10
  - @mastra/pg@1.23.0-alpha.4

## 1.7.0-alpha.10

### Patch Changes

- Restore the default explore, plan, and execute subagents in Mastra Code while preserving explicit empty and custom subagent configurations. Match delegation prompt guidance to tool availability and permissions. ([#23217](https://github.com/mastra-ai/mastra/pull/23217))

- Updated dependencies [[`54adc91`](https://github.com/mastra-ai/mastra/commit/54adc9164beee68798adff0bfb0ebae4dada1af0), [`c9b21f3`](https://github.com/mastra-ai/mastra/commit/c9b21f39792f892c91e616a67f9cfb19ddaa8046), [`4362001`](https://github.com/mastra-ai/mastra/commit/436200145bf70d825918e60f6dbdd2389a749e48)]:
  - @mastra/core@1.65.0-alpha.9

## 1.7.0-alpha.9

### Patch Changes

- Updated dependencies [[`db7cc1c`](https://github.com/mastra-ai/mastra/commit/db7cc1c5d8cd1650c41c57590c25ab86c9e5032f), [`88abfbf`](https://github.com/mastra-ai/mastra/commit/88abfbf5fb256e0b5602aafa6e733192f9a4236a), [`db7cc1c`](https://github.com/mastra-ai/mastra/commit/db7cc1c5d8cd1650c41c57590c25ab86c9e5032f), [`64db1b3`](https://github.com/mastra-ai/mastra/commit/64db1b313bdb02e063019fdcbb8d28608858ae71)]:
  - @mastra/memory@1.28.3-alpha.3
  - @mastra/core@1.65.0-alpha.8
  - @mastra/pg@1.23.0-alpha.3

## 1.7.0-alpha.8

### Patch Changes

- Updated dependencies [[`51b2b5e`](https://github.com/mastra-ai/mastra/commit/51b2b5e0ca9ba4a23fc6544246ad9822c4dbd92e), [`6a05d36`](https://github.com/mastra-ai/mastra/commit/6a05d36a0bb28390539cfc5a4f12c847474d28d2), [`6a05d36`](https://github.com/mastra-ai/mastra/commit/6a05d36a0bb28390539cfc5a4f12c847474d28d2)]:
  - @mastra/core@1.65.0-alpha.7
  - @mastra/pg@1.23.0-alpha.2

## 1.7.0-alpha.7

### Patch Changes

- Stop advertising Bedrock models that cannot be served over Converse. Nine `bedrock-mantle` entries in the models.dev catalog carry a `provider` override pointing at a different endpoint and API shape, but every catalog id is handed to `createAmazonBedrock()`, so they appeared in the `/models` picker and in packs while being unreachable. They are now filtered out of the advertised catalog. ([#23061](https://github.com/mastra-ai/mastra/pull/23061))

- Updated dependencies [[`2911c88`](https://github.com/mastra-ai/mastra/commit/2911c88c9226f5ab969abc3a90b161c1c1cbd19e), [`66029df`](https://github.com/mastra-ai/mastra/commit/66029dfccb8f5d69f26d8df920647b34a0a763d1), [`ce2f341`](https://github.com/mastra-ai/mastra/commit/ce2f34171a8e1eee428219670a0a7897083c91e3), [`5901b59`](https://github.com/mastra-ai/mastra/commit/5901b5920a08f1869092e5e4cccf8a0be17781e9), [`8c96b5c`](https://github.com/mastra-ai/mastra/commit/8c96b5c6a3c55d4665ee8dd4f9c55bb14e8e1dd3)]:
  - @mastra/core@1.65.0-alpha.6

## 1.7.0-alpha.6

### Patch Changes

- Enabled Amazon Bedrock prompt caching for Claude Opus 5 models. ([#23092](https://github.com/mastra-ai/mastra/pull/23092))

- Updated dependencies [[`917da71`](https://github.com/mastra-ai/mastra/commit/917da711580cdc9e8f7ca474b301f3611a5c46ed), [`a5f22f4`](https://github.com/mastra-ai/mastra/commit/a5f22f4ff1763ab9679391a6a9118358c8059e11)]:
  - @mastra/core@1.65.0-alpha.5

## 1.7.0-alpha.5

### Patch Changes

- Improved the agent's guidance for memory tools. ([#23039](https://github.com/mastra-ai/mastra/pull/23039))

- Updated dependencies [[`fce0b9f`](https://github.com/mastra-ai/mastra/commit/fce0b9f1c3991acdb7ec7c9ada78bc39762319c1), [`e4852fc`](https://github.com/mastra-ai/mastra/commit/e4852fc42fc9e72559370dfa9b0e3f20ccf9012e), [`e4852fc`](https://github.com/mastra-ai/mastra/commit/e4852fc42fc9e72559370dfa9b0e3f20ccf9012e), [`e4852fc`](https://github.com/mastra-ai/mastra/commit/e4852fc42fc9e72559370dfa9b0e3f20ccf9012e), [`b1227c0`](https://github.com/mastra-ai/mastra/commit/b1227c0604be8c33dd02705fe6978df70c32f87d), [`0c62271`](https://github.com/mastra-ai/mastra/commit/0c622712c3e62fb3108ec6090f2187df38666437), [`e4852fc`](https://github.com/mastra-ai/mastra/commit/e4852fc42fc9e72559370dfa9b0e3f20ccf9012e)]:
  - @mastra/memory@1.28.3-alpha.2
  - @mastra/libsql@1.22.4-alpha.0
  - @mastra/core@1.65.0-alpha.4
  - @mastra/pg@1.23.0-alpha.1
  - @mastra/duckdb@1.7.0-alpha.1

## 1.7.0-alpha.4

### Patch Changes

- Fixed Windows file references in custom slash commands, including `@src\context.md`, ([#21632](https://github.com/mastra-ai/mastra/pull/21632))
  `@C:\path\to\file`, and `@C:/path/to/file`. Spaces, quoted paths, and glob patterns
  are not supported.
- Updated dependencies [[`abb0263`](https://github.com/mastra-ai/mastra/commit/abb0263bc5740868dd9b3b615312a0b9e040747f), [`f649ea0`](https://github.com/mastra-ai/mastra/commit/f649ea0f006436e7268c3b0fa45f9865a02130cc), [`18d99e7`](https://github.com/mastra-ai/mastra/commit/18d99e7b5687ea6a1cdb601fa5c4209a03b97c02), [`a0ad935`](https://github.com/mastra-ai/mastra/commit/a0ad9351eaf8527d1515051ddf3998ee258b9acd), [`e5a8e80`](https://github.com/mastra-ai/mastra/commit/e5a8e80caef6aaa00495de9e00d11f06c4a78bdb)]:
  - @mastra/observability@1.17.6-alpha.1
  - @mastra/core@1.65.0-alpha.3
  - @mastra/mcp@1.17.3

## 1.7.0-alpha.3

### Patch Changes

- Read `/knowledge` from the same scope the Subconscious writes under. The knowledge browser was building its org rung from the session owner id (a user id), while local curation writes under the fixed `local` org, so the browser always looked at an empty scope. Both the memory factory and the inspector now derive their org/resource rungs from one resolver, and the local org id is exported as `LOCAL_KNOWLEDGE_ORG_ID`. Factory sessions keep failing closed when their org is unresolved. ([#22944](https://github.com/mastra-ai/mastra/pull/22944))

- Updated dependencies [[`ae375e6`](https://github.com/mastra-ai/mastra/commit/ae375e6799af20820d90e30f63a084ba1507b771), [`7f107dd`](https://github.com/mastra-ai/mastra/commit/7f107dd68c9d1d3906cb31db7fcd222991281b5b), [`c66e628`](https://github.com/mastra-ai/mastra/commit/c66e6284421eabaca23029c2089a070ffd914678), [`6827484`](https://github.com/mastra-ai/mastra/commit/6827484382bb2a4d0781ed9c76a432cdbd75e50a)]:
  - @mastra/core@1.65.0-alpha.2
  - @mastra/pg@1.23.0-alpha.0
  - @mastra/memory@1.28.3-alpha.1
  - @mastra/duckdb@1.7.0-alpha.0

## 1.7.0-alpha.2

### Minor Changes

- Added host-provided session instructions so workspace-free agent sessions can receive purpose-specific guidance. ([#23001](https://github.com/mastra-ai/mastra/pull/23001))

  ```ts
  createMastraCodeAgentController({
    hostInstructions: 'Help operators inspect and repair Factory state.',
  });
  ```

## 1.6.1-alpha.1

### Patch Changes

- Updated dependencies [[`b72c747`](https://github.com/mastra-ai/mastra/commit/b72c747a1a698c829c7c1d42e75f72c6d1808dde), [`89f2486`](https://github.com/mastra-ai/mastra/commit/89f2486028ce25c5db19d1f361d5f65cd3ff93e5), [`1778103`](https://github.com/mastra-ai/mastra/commit/17781034204a151a1ff910e9d11d21effe22a9e0), [`2801d26`](https://github.com/mastra-ai/mastra/commit/2801d26b69bbe8929d302abd09619a68b4cc0d98), [`2801d26`](https://github.com/mastra-ai/mastra/commit/2801d26b69bbe8929d302abd09619a68b4cc0d98), [`2801d26`](https://github.com/mastra-ai/mastra/commit/2801d26b69bbe8929d302abd09619a68b4cc0d98), [`ffc6440`](https://github.com/mastra-ai/mastra/commit/ffc6440d13b9392b3cf1ff309d3b9cde4a791038), [`f31c3fa`](https://github.com/mastra-ai/mastra/commit/f31c3fae16a0710f9e52dba9bccc0018f9da2ac1), [`9d647e2`](https://github.com/mastra-ai/mastra/commit/9d647e25b51cd246ef974d9cad6b05dfdd37126e)]:
  - @mastra/core@1.65.0-alpha.1
  - @mastra/observability@1.17.6-alpha.0
  - @mastra/memory@1.28.3-alpha.0
  - @mastra/mcp@1.17.3

## 1.6.1-alpha.0

### Patch Changes

- Updated dependencies [[`eef3409`](https://github.com/mastra-ai/mastra/commit/eef3409c125dcd9765e4a85d17f10c53892f6f2c)]:
  - @mastra/core@1.64.1-alpha.0

## 1.6.0

### Minor Changes

- `SandboxFilesystem` accepts a lazy `workdir` — a resolver function awaited on the first file operation and memoized — for sandboxes whose workspace root is only knowable once the VM is running (repos clone into the VM's own home dir). `basePath` reports empty and `resolveAbsolutePath` returns undefined until the root resolves; a failed resolution is not memoized, so the next operation retries. ([#22065](https://github.com/mastra-ai/mastra/pull/22065))

- Remove the sandbox reattach seam (`@mastra/code-sdk/agents/sandbox-reattach` — `registerSandboxReattach`/`reattachProjectSandbox`) and the state-driven sandbox workspace branch in `getDynamicWorkspace` (`state.projectRepositoryId`/`sandboxId`/`sandboxWorkdir`). Factory resolves session workspaces through its own sandbox callback; the UI-pushed sandbox coordinates in controller state were read by a code path that could no longer execute. The `sandboxId`/`sandboxWorkdir`/`worktreePath` state fields are removed from the state schema entirely — nothing reads them (the workdir is always live-resolved from the sandbox, and the sandbox id is the session id). Old clients still sending them are unaffected: unknown state keys are stripped on parse. ([#22065](https://github.com/mastra-ai/mastra/pull/22065))

- Enabled first-message thread title generation for all Mastra Code clients. ([#22560](https://github.com/mastra-ai/mastra/pull/22560))

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Improve internal observational-memory processing. ([#22738](https://github.com/mastra-ai/mastra/pull/22738))

- Signed-in Factory accounts now get a clear, actionable error when no usable provider credential is available, instead of a silent failure. ([#22721](https://github.com/mastra-ai/mastra/pull/22721))

- Hosted sessions no longer leak the host process's environment into the system prompt. The dynamic instructions builder drops its `process.cwd()` fallback: a session without a `projectPath` gets no working directory, no host git-branch probe, and loads no instruction files at all (project locations would resolve against the server's cwd and global locations against the server's homedir). Factory additionally blanks the SDK's default project identity seed (`projectPath`/`projectName`/`gitBranch` from the host's own checkout) so chat-only sessions show "(no workspace attached)" instead of the server's repo and branch; repo-backed sessions keep getting their real session workdir pinned by workspace resolution. ([#22065](https://github.com/mastra-ai/mastra/pull/22065))

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

- Updated dependencies [[`3910c77`](https://github.com/mastra-ai/mastra/commit/3910c77413a3058ab270c6dbc74a59bc3cdf67ea), [`f7ad6a6`](https://github.com/mastra-ai/mastra/commit/f7ad6a6f7fd7a5d4bc9ea80b47ceeee83a7bb59d), [`decd47d`](https://github.com/mastra-ai/mastra/commit/decd47d0db2a891a6832e226557145b6658b0b19), [`c1d3422`](https://github.com/mastra-ai/mastra/commit/c1d3422e8052a4282e8547df914b6231e5345f01), [`285ce1c`](https://github.com/mastra-ai/mastra/commit/285ce1c1399341a37e76233aa94dbf9f1a41bd5d), [`e983f74`](https://github.com/mastra-ai/mastra/commit/e983f749873189f767f509eb33d1a3596c0f1c74), [`4596348`](https://github.com/mastra-ai/mastra/commit/45963483f4cd2810f0646469916f74266a3dd607), [`b40fa91`](https://github.com/mastra-ai/mastra/commit/b40fa91496d794e060494f9c0d2fe940912f9190), [`7686114`](https://github.com/mastra-ai/mastra/commit/7686114e3802f4cea414377eaf10999524d670fa), [`ea56b1f`](https://github.com/mastra-ai/mastra/commit/ea56b1fa6e0f99673d2f8a5b7dacc8d351507ff7), [`50469b2`](https://github.com/mastra-ai/mastra/commit/50469b2d085fc8550579ca4b741eb359d1705abc), [`5b5e3cc`](https://github.com/mastra-ai/mastra/commit/5b5e3cc006950b0ff9720c5be8396d4c95e8a6ac), [`809e882`](https://github.com/mastra-ai/mastra/commit/809e882ee9c154ac642eaed396163df706db6ae4), [`7686114`](https://github.com/mastra-ai/mastra/commit/7686114e3802f4cea414377eaf10999524d670fa), [`c975ebd`](https://github.com/mastra-ai/mastra/commit/c975ebdb0b32c13fd9d9e780fe9e1422cbd2a6d6), [`cedc25d`](https://github.com/mastra-ai/mastra/commit/cedc25d8c2dec005d8b10b6ce2d36feef1162ff0), [`82c7754`](https://github.com/mastra-ai/mastra/commit/82c7754bec28b5428ea0f61cc16851aca6f3b76b), [`1255235`](https://github.com/mastra-ai/mastra/commit/125523539237c39f84d126d16476093336089c0d), [`ec611c2`](https://github.com/mastra-ai/mastra/commit/ec611c28049b8cf36d5519eae944bf299f6ccd99), [`2e87ffb`](https://github.com/mastra-ai/mastra/commit/2e87ffbb454cc88bd8a8c022d1e46325e7907482), [`a499422`](https://github.com/mastra-ai/mastra/commit/a499422cd7eccca184cac7b7a684a6199784aa82), [`cf58c86`](https://github.com/mastra-ai/mastra/commit/cf58c86cb48ccc72677bdaa422e43f102683184c), [`285ce1c`](https://github.com/mastra-ai/mastra/commit/285ce1c1399341a37e76233aa94dbf9f1a41bd5d), [`a3606a0`](https://github.com/mastra-ai/mastra/commit/a3606a09f3deaeef17caf04b9c6a0d7cd6b80fe6), [`4cde9ab`](https://github.com/mastra-ai/mastra/commit/4cde9ab9b3c8dfd91852794018b39fb68c346f28), [`604da15`](https://github.com/mastra-ai/mastra/commit/604da153fe3170b7e4d9402b0f02ce417b39b417), [`4095752`](https://github.com/mastra-ai/mastra/commit/40957529233d202446ebecab1f59c76e99910230), [`74b21fd`](https://github.com/mastra-ai/mastra/commit/74b21fd9bbe88e770d9acf4e00e01c8bbb7c9e61), [`045c3c7`](https://github.com/mastra-ai/mastra/commit/045c3c78f2129fea5d4467bb26cff2b49788b3d0), [`a3606a0`](https://github.com/mastra-ai/mastra/commit/a3606a09f3deaeef17caf04b9c6a0d7cd6b80fe6), [`449d112`](https://github.com/mastra-ai/mastra/commit/449d1120cc1f9c43a71308a9fd8b178cfb11355f), [`e8aca33`](https://github.com/mastra-ai/mastra/commit/e8aca339dc92c0b60baad3d948a7c48ec9ae106f), [`c5c9ffc`](https://github.com/mastra-ai/mastra/commit/c5c9ffc3b36bdc7b17d6f911be81e28ba02acfad), [`9d3073c`](https://github.com/mastra-ai/mastra/commit/9d3073c230dbff45d58c259d676b2b137afd2ff5), [`f01f822`](https://github.com/mastra-ai/mastra/commit/f01f822cbe2042d4014c0ae883205da03fff5a00), [`19b71cf`](https://github.com/mastra-ai/mastra/commit/19b71cf1de8afe6f69a3171d8a5a28086790e49b), [`2a0ca02`](https://github.com/mastra-ai/mastra/commit/2a0ca021d95e23f1d1c0b5fe858b0b56f71fe0ba), [`ff539f6`](https://github.com/mastra-ai/mastra/commit/ff539f6dc21137fbeb3f0867f07069cbce45c15f), [`9fdb3bc`](https://github.com/mastra-ai/mastra/commit/9fdb3bc0f9bfab5269b4f3045595e62323da5d3a), [`d53a056`](https://github.com/mastra-ai/mastra/commit/d53a05614893e8d1bbfdab50b42c19435e6bd065), [`d94e242`](https://github.com/mastra-ai/mastra/commit/d94e2423909cfc859eaf39827e83c832439e6b6d), [`8571a42`](https://github.com/mastra-ai/mastra/commit/8571a42c8039e938564e5c5fb0a6b75377c4fe67), [`420052f`](https://github.com/mastra-ai/mastra/commit/420052fcac3fc672be17fe655667dfbdbd35a2cc), [`217b2ab`](https://github.com/mastra-ai/mastra/commit/217b2ab9dab852a232eff8d0cfe2b2ecdbd39dc3), [`28ce924`](https://github.com/mastra-ai/mastra/commit/28ce924276eeca492e6a360e5482ed20c2785ef6)]:
  - @mastra/core@1.64.0
  - @mastra/libsql@1.22.3
  - @mastra/schema-compat@1.3.8
  - @mastra/agent-browser@0.5.2
  - @mastra/parallel@0.1.1
  - @mastra/observability@1.17.5
  - @mastra/tavily@1.1.2
  - @mastra/fastembed@1.3.1
  - @mastra/stagehand@0.3.4
  - @mastra/memory@1.28.2
  - @mastra/github-signals@0.4.0
  - @mastra/duckdb@1.6.4
  - @mastra/mcp@1.17.3
  - @mastra/pg@1.22.3

## 1.6.0-alpha.11

### Patch Changes

- Updated dependencies [[`7686114`](https://github.com/mastra-ai/mastra/commit/7686114e3802f4cea414377eaf10999524d670fa), [`50469b2`](https://github.com/mastra-ai/mastra/commit/50469b2d085fc8550579ca4b741eb359d1705abc), [`809e882`](https://github.com/mastra-ai/mastra/commit/809e882ee9c154ac642eaed396163df706db6ae4), [`7686114`](https://github.com/mastra-ai/mastra/commit/7686114e3802f4cea414377eaf10999524d670fa), [`74b21fd`](https://github.com/mastra-ai/mastra/commit/74b21fd9bbe88e770d9acf4e00e01c8bbb7c9e61), [`c5c9ffc`](https://github.com/mastra-ai/mastra/commit/c5c9ffc3b36bdc7b17d6f911be81e28ba02acfad)]:
  - @mastra/core@1.64.0-alpha.9
  - @mastra/pg@1.22.3-alpha.4
  - @mastra/duckdb@1.6.4-alpha.2

## 1.6.0-alpha.10

### Patch Changes

- Updated dependencies [[`ea56b1f`](https://github.com/mastra-ai/mastra/commit/ea56b1fa6e0f99673d2f8a5b7dacc8d351507ff7), [`ec611c2`](https://github.com/mastra-ai/mastra/commit/ec611c28049b8cf36d5519eae944bf299f6ccd99), [`4cde9ab`](https://github.com/mastra-ai/mastra/commit/4cde9ab9b3c8dfd91852794018b39fb68c346f28)]:
  - @mastra/core@1.64.0-alpha.8
  - @mastra/memory@1.28.2-alpha.3
  - @mastra/observability@1.17.5-alpha.2
  - @mastra/mcp@1.17.3-alpha.2

## 1.6.0-alpha.9

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Improve internal observational-memory processing. ([#22738](https://github.com/mastra-ai/mastra/pull/22738))

- Updated dependencies [[`e983f74`](https://github.com/mastra-ai/mastra/commit/e983f749873189f767f509eb33d1a3596c0f1c74), [`b40fa91`](https://github.com/mastra-ai/mastra/commit/b40fa91496d794e060494f9c0d2fe940912f9190), [`cedc25d`](https://github.com/mastra-ai/mastra/commit/cedc25d8c2dec005d8b10b6ce2d36feef1162ff0), [`9fdb3bc`](https://github.com/mastra-ai/mastra/commit/9fdb3bc0f9bfab5269b4f3045595e62323da5d3a), [`217b2ab`](https://github.com/mastra-ai/mastra/commit/217b2ab9dab852a232eff8d0cfe2b2ecdbd39dc3)]:
  - @mastra/schema-compat@1.3.8-alpha.1
  - @mastra/agent-browser@0.5.2-alpha.1
  - @mastra/parallel@0.1.1-alpha.1
  - @mastra/observability@1.17.5-alpha.1
  - @mastra/tavily@1.1.2-alpha.1
  - @mastra/fastembed@1.3.1-alpha.1
  - @mastra/stagehand@0.3.4-alpha.1
  - @mastra/memory@1.28.2-alpha.2
  - @mastra/github-signals@0.4.0-alpha.2
  - @mastra/core@1.64.0-alpha.7
  - @mastra/duckdb@1.6.4-alpha.1
  - @mastra/libsql@1.22.3-alpha.3
  - @mastra/mcp@1.17.3-alpha.2
  - @mastra/pg@1.22.3-alpha.3

## 1.6.0-alpha.8

### Patch Changes

- Updated dependencies [[`f7ad6a6`](https://github.com/mastra-ai/mastra/commit/f7ad6a6f7fd7a5d4bc9ea80b47ceeee83a7bb59d), [`c1d3422`](https://github.com/mastra-ai/mastra/commit/c1d3422e8052a4282e8547df914b6231e5345f01), [`4596348`](https://github.com/mastra-ai/mastra/commit/45963483f4cd2810f0646469916f74266a3dd607), [`82c7754`](https://github.com/mastra-ai/mastra/commit/82c7754bec28b5428ea0f61cc16851aca6f3b76b), [`e8aca33`](https://github.com/mastra-ai/mastra/commit/e8aca339dc92c0b60baad3d948a7c48ec9ae106f), [`19b71cf`](https://github.com/mastra-ai/mastra/commit/19b71cf1de8afe6f69a3171d8a5a28086790e49b)]:
  - @mastra/libsql@1.22.3-alpha.2
  - @mastra/core@1.64.0-alpha.6
  - @mastra/pg@1.22.3-alpha.2

## 1.6.0-alpha.7

### Patch Changes

- Updated dependencies [[`decd47d`](https://github.com/mastra-ai/mastra/commit/decd47d0db2a891a6832e226557145b6658b0b19), [`285ce1c`](https://github.com/mastra-ai/mastra/commit/285ce1c1399341a37e76233aa94dbf9f1a41bd5d), [`5b5e3cc`](https://github.com/mastra-ai/mastra/commit/5b5e3cc006950b0ff9720c5be8396d4c95e8a6ac), [`285ce1c`](https://github.com/mastra-ai/mastra/commit/285ce1c1399341a37e76233aa94dbf9f1a41bd5d), [`045c3c7`](https://github.com/mastra-ai/mastra/commit/045c3c78f2129fea5d4467bb26cff2b49788b3d0), [`f01f822`](https://github.com/mastra-ai/mastra/commit/f01f822cbe2042d4014c0ae883205da03fff5a00), [`d53a056`](https://github.com/mastra-ai/mastra/commit/d53a05614893e8d1bbfdab50b42c19435e6bd065)]:
  - @mastra/core@1.64.0-alpha.5
  - @mastra/mcp@1.17.3-alpha.1
  - @mastra/libsql@1.22.3-alpha.1
  - @mastra/pg@1.22.3-alpha.1

## 1.6.0-alpha.6

### Patch Changes

- Updated dependencies [[`a499422`](https://github.com/mastra-ai/mastra/commit/a499422cd7eccca184cac7b7a684a6199784aa82), [`9d3073c`](https://github.com/mastra-ai/mastra/commit/9d3073c230dbff45d58c259d676b2b137afd2ff5)]:
  - @mastra/core@1.64.0-alpha.4

## 1.6.0-alpha.5

### Patch Changes

- Updated dependencies [[`2e87ffb`](https://github.com/mastra-ai/mastra/commit/2e87ffbb454cc88bd8a8c022d1e46325e7907482)]:
  - @mastra/core@1.64.0-alpha.3

## 1.6.0-alpha.4

### Patch Changes

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

- Updated dependencies [[`c975ebd`](https://github.com/mastra-ai/mastra/commit/c975ebdb0b32c13fd9d9e780fe9e1422cbd2a6d6), [`cf58c86`](https://github.com/mastra-ai/mastra/commit/cf58c86cb48ccc72677bdaa422e43f102683184c), [`449d112`](https://github.com/mastra-ai/mastra/commit/449d1120cc1f9c43a71308a9fd8b178cfb11355f), [`2a0ca02`](https://github.com/mastra-ai/mastra/commit/2a0ca021d95e23f1d1c0b5fe858b0b56f71fe0ba), [`ff539f6`](https://github.com/mastra-ai/mastra/commit/ff539f6dc21137fbeb3f0867f07069cbce45c15f), [`420052f`](https://github.com/mastra-ai/mastra/commit/420052fcac3fc672be17fe655667dfbdbd35a2cc), [`28ce924`](https://github.com/mastra-ai/mastra/commit/28ce924276eeca492e6a360e5482ed20c2785ef6)]:
  - @mastra/duckdb@1.6.4-alpha.0
  - @mastra/core@1.64.0-alpha.2
  - @mastra/observability@1.17.5-alpha.0
  - @mastra/schema-compat@1.3.8-alpha.0
  - @mastra/agent-browser@0.5.2-alpha.0
  - @mastra/parallel@0.1.1-alpha.0
  - @mastra/tavily@1.1.2-alpha.0
  - @mastra/fastembed@1.3.1-alpha.0
  - @mastra/stagehand@0.3.4-alpha.0
  - @mastra/memory@1.28.2-alpha.1
  - @mastra/github-signals@0.4.0-alpha.1
  - @mastra/libsql@1.22.3-alpha.0
  - @mastra/mcp@1.17.3-alpha.0
  - @mastra/pg@1.22.3-alpha.0

## 1.6.0-alpha.3

### Patch Changes

- Improved diagnostics and error guidance when deployed tenant credential resolution fails closed. ([#22721](https://github.com/mastra-ai/mastra/pull/22721))

## 1.6.0-alpha.2

### Minor Changes

- Enabled first-message thread title generation for all Mastra Code clients. ([#22560](https://github.com/mastra-ai/mastra/pull/22560))

### Patch Changes

- Updated dependencies [[`604da15`](https://github.com/mastra-ai/mastra/commit/604da153fe3170b7e4d9402b0f02ce417b39b417), [`d94e242`](https://github.com/mastra-ai/mastra/commit/d94e2423909cfc859eaf39827e83c832439e6b6d), [`8571a42`](https://github.com/mastra-ai/mastra/commit/8571a42c8039e938564e5c5fb0a6b75377c4fe67)]:
  - @mastra/github-signals@0.4.0-alpha.0
  - @mastra/memory@1.28.2-alpha.0

## 1.6.0-alpha.1

### Patch Changes

- Updated dependencies [[`a3606a0`](https://github.com/mastra-ai/mastra/commit/a3606a09f3deaeef17caf04b9c6a0d7cd6b80fe6), [`4095752`](https://github.com/mastra-ai/mastra/commit/40957529233d202446ebecab1f59c76e99910230), [`a3606a0`](https://github.com/mastra-ai/mastra/commit/a3606a09f3deaeef17caf04b9c6a0d7cd6b80fe6)]:
  - @mastra/core@1.63.3-alpha.1

## 1.6.0-alpha.0

### Minor Changes

- `SandboxFilesystem` accepts a lazy `workdir` — a resolver function awaited on the first file operation and memoized — for sandboxes whose workspace root is only knowable once the VM is running (repos clone into the VM's own home dir). `basePath` reports empty and `resolveAbsolutePath` returns undefined until the root resolves; a failed resolution is not memoized, so the next operation retries. ([#22065](https://github.com/mastra-ai/mastra/pull/22065))

- Remove the sandbox reattach seam (`@mastra/code-sdk/agents/sandbox-reattach` — `registerSandboxReattach`/`reattachProjectSandbox`) and the state-driven sandbox workspace branch in `getDynamicWorkspace` (`state.projectRepositoryId`/`sandboxId`/`sandboxWorkdir`). Factory resolves session workspaces through its own sandbox callback; the UI-pushed sandbox coordinates in controller state were read by a code path that could no longer execute. The `sandboxId`/`sandboxWorkdir`/`worktreePath` state fields are removed from the state schema entirely — nothing reads them (the workdir is always live-resolved from the sandbox, and the sandbox id is the session id). Old clients still sending them are unaffected: unknown state keys are stripped on parse. ([#22065](https://github.com/mastra-ai/mastra/pull/22065))

### Patch Changes

- Hosted sessions no longer leak the host process's environment into the system prompt. The dynamic instructions builder drops its `process.cwd()` fallback: a session without a `projectPath` gets no working directory, no host git-branch probe, and loads no instruction files at all (project locations would resolve against the server's cwd and global locations against the server's homedir). Factory additionally blanks the SDK's default project identity seed (`projectPath`/`projectName`/`gitBranch` from the host's own checkout) so chat-only sessions show "(no workspace attached)" instead of the server's repo and branch; repo-backed sessions keep getting their real session workdir pinned by workspace resolution. ([#22065](https://github.com/mastra-ai/mastra/pull/22065))

- Updated dependencies [[`3910c77`](https://github.com/mastra-ai/mastra/commit/3910c77413a3058ab270c6dbc74a59bc3cdf67ea)]:
  - @mastra/core@1.63.3-alpha.0

## 1.5.3

### Patch Changes

- Updated dependencies [[`3e7eced`](https://github.com/mastra-ai/mastra/commit/3e7eced50f51fb068cba581763248a012f295ba4), [`3e7eced`](https://github.com/mastra-ai/mastra/commit/3e7eced50f51fb068cba581763248a012f295ba4), [`0a9d29c`](https://github.com/mastra-ai/mastra/commit/0a9d29c0c4dbbaa6afc1c8146cdd41759cbd4002)]:
  - @mastra/libsql@1.22.2
  - @mastra/pg@1.22.2
  - @mastra/core@1.63.2

## 1.5.3-alpha.0

### Patch Changes

- Updated dependencies [[`3e7eced`](https://github.com/mastra-ai/mastra/commit/3e7eced50f51fb068cba581763248a012f295ba4), [`3e7eced`](https://github.com/mastra-ai/mastra/commit/3e7eced50f51fb068cba581763248a012f295ba4), [`0a9d29c`](https://github.com/mastra-ai/mastra/commit/0a9d29c0c4dbbaa6afc1c8146cdd41759cbd4002)]:
  - @mastra/libsql@1.22.2-alpha.0
  - @mastra/pg@1.22.2-alpha.0
  - @mastra/core@1.63.2-alpha.0

## 1.5.2

### Patch Changes

- Added Kimi For Coding account authentication, API key authentication, token refresh, and model routing. ([#22428](https://github.com/mastra-ai/mastra/pull/22428))

  ```text
  /connect
  ```

- Fix knowledge captured in factory sessions being stored in the wrong tenant. ([#21823](https://github.com/mastra-ai/mastra/pull/21823))

  Knowledge captured during a factory session is now always stored under the organization
  that owns the session, so it is visible in that organization's knowledge graph. A session
  whose organization cannot be determined no longer stores knowledge somewhere it could
  never be read back from; it stops capturing and reports why. Local (TUI/studio) use is
  unaffected and captures under a dedicated local scope.

- Updated dependencies [[`bae1502`](https://github.com/mastra-ai/mastra/commit/bae150254b06a4da6964d7c137af97f336362359), [`0885364`](https://github.com/mastra-ai/mastra/commit/0885364c2fc7fa31febcfc444fc1ba5231ac1257), [`295e506`](https://github.com/mastra-ai/mastra/commit/295e506b9e6cec99e7181c5f712648888cd9486f), [`b8cb683`](https://github.com/mastra-ai/mastra/commit/b8cb683ba66499df254ddd1f7edd8cae3f89d2e7), [`8c3be07`](https://github.com/mastra-ai/mastra/commit/8c3be0761a862c5c035ed6e5d633de87cbba20e7), [`078affd`](https://github.com/mastra-ai/mastra/commit/078affdaea57ac5e95a77e9e7b197d1878190684), [`a87ff53`](https://github.com/mastra-ai/mastra/commit/a87ff53cef9318bea80c38c3bf3d9d9d507ac3c1), [`9e3403e`](https://github.com/mastra-ai/mastra/commit/9e3403e9868240cb18841898e84cf008ebd7a87e), [`791bf5e`](https://github.com/mastra-ai/mastra/commit/791bf5e81cd27e2e1cff66122f1380ab8a3dda41)]:
  - @mastra/core@1.63.1
  - @mastra/memory@1.28.1
  - @mastra/libsql@1.22.1
  - @mastra/pg@1.22.1
  - @mastra/observability@1.17.4
  - @mastra/mcp@1.17.2

## 1.5.2-alpha.3

### Patch Changes

- Updated dependencies [[`b8cb683`](https://github.com/mastra-ai/mastra/commit/b8cb683ba66499df254ddd1f7edd8cae3f89d2e7)]:
  - @mastra/core@1.63.1-alpha.3

## 1.5.2-alpha.2

### Patch Changes

- Added Kimi For Coding account authentication, API key authentication, token refresh, and model routing. ([#22428](https://github.com/mastra-ai/mastra/pull/22428))

  ```text
  /connect
  ```

- Updated dependencies [[`0885364`](https://github.com/mastra-ai/mastra/commit/0885364c2fc7fa31febcfc444fc1ba5231ac1257)]:
  - @mastra/core@1.63.1-alpha.2
  - @mastra/memory@1.28.1-alpha.1
  - @mastra/libsql@1.22.1-alpha.0
  - @mastra/pg@1.22.1-alpha.0

## 1.5.2-alpha.1

### Patch Changes

- Fix knowledge captured in factory sessions being stored in the wrong tenant. ([#21823](https://github.com/mastra-ai/mastra/pull/21823))

  Knowledge captured during a factory session is now always stored under the organization
  that owns the session, so it is visible in that organization's knowledge graph. A session
  whose organization cannot be determined no longer stores knowledge somewhere it could
  never be read back from; it stops capturing and reports why. Local (TUI/studio) use is
  unaffected and captures under a dedicated local scope.

- Updated dependencies [[`295e506`](https://github.com/mastra-ai/mastra/commit/295e506b9e6cec99e7181c5f712648888cd9486f), [`8c3be07`](https://github.com/mastra-ai/mastra/commit/8c3be0761a862c5c035ed6e5d633de87cbba20e7), [`078affd`](https://github.com/mastra-ai/mastra/commit/078affdaea57ac5e95a77e9e7b197d1878190684), [`a87ff53`](https://github.com/mastra-ai/mastra/commit/a87ff53cef9318bea80c38c3bf3d9d9d507ac3c1), [`9e3403e`](https://github.com/mastra-ai/mastra/commit/9e3403e9868240cb18841898e84cf008ebd7a87e), [`791bf5e`](https://github.com/mastra-ai/mastra/commit/791bf5e81cd27e2e1cff66122f1380ab8a3dda41)]:
  - @mastra/memory@1.28.1-alpha.0
  - @mastra/core@1.63.1-alpha.1
  - @mastra/observability@1.17.4-alpha.0
  - @mastra/mcp@1.17.2

## 1.5.2-alpha.0

### Patch Changes

- Updated dependencies [[`bae1502`](https://github.com/mastra-ai/mastra/commit/bae150254b06a4da6964d7c137af97f336362359)]:
  - @mastra/core@1.63.1-alpha.0

## 1.5.1

### Patch Changes

- Updated dependencies [[`7176362`](https://github.com/mastra-ai/mastra/commit/717636281a3339911a05ea2cc8ae38afe4fd2cef), [`9045b8f`](https://github.com/mastra-ai/mastra/commit/9045b8fdf622e1d735b96ddd6500bd32556636d9), [`e3b796d`](https://github.com/mastra-ai/mastra/commit/e3b796d29a63f0d5c97dd815aadec40687346d70), [`7677a2c`](https://github.com/mastra-ai/mastra/commit/7677a2cd47729221ca28afc5067d26e22d925b59), [`e3b796d`](https://github.com/mastra-ai/mastra/commit/e3b796d29a63f0d5c97dd815aadec40687346d70), [`f7a7467`](https://github.com/mastra-ai/mastra/commit/f7a74678193921e7ea4790232d707b3237626cac), [`49ccd14`](https://github.com/mastra-ai/mastra/commit/49ccd142268a61fb55ea75bc76287643a21f3677), [`f9c56f3`](https://github.com/mastra-ai/mastra/commit/f9c56f336ee8c250763a438990f8e60a428353c9), [`3855b38`](https://github.com/mastra-ai/mastra/commit/3855b38c4c25af32ab8e298e148becc963abe92c)]:
  - @mastra/core@1.63.0
  - @mastra/observability@1.17.3
  - @mastra/mcp@1.17.2

## 1.5.1-alpha.1

### Patch Changes

- Updated dependencies [[`7677a2c`](https://github.com/mastra-ai/mastra/commit/7677a2cd47729221ca28afc5067d26e22d925b59), [`f7a7467`](https://github.com/mastra-ai/mastra/commit/f7a74678193921e7ea4790232d707b3237626cac), [`f9c56f3`](https://github.com/mastra-ai/mastra/commit/f9c56f336ee8c250763a438990f8e60a428353c9)]:
  - @mastra/core@1.63.0-alpha.1

## 1.5.1-alpha.0

### Patch Changes

- Updated dependencies [[`7176362`](https://github.com/mastra-ai/mastra/commit/717636281a3339911a05ea2cc8ae38afe4fd2cef), [`e3b796d`](https://github.com/mastra-ai/mastra/commit/e3b796d29a63f0d5c97dd815aadec40687346d70), [`e3b796d`](https://github.com/mastra-ai/mastra/commit/e3b796d29a63f0d5c97dd815aadec40687346d70), [`49ccd14`](https://github.com/mastra-ai/mastra/commit/49ccd142268a61fb55ea75bc76287643a21f3677), [`3855b38`](https://github.com/mastra-ai/mastra/commit/3855b38c4c25af32ab8e298e148becc963abe92c)]:
  - @mastra/core@1.63.0-alpha.0
  - @mastra/observability@1.17.3-alpha.0
  - @mastra/mcp@1.17.2

## 1.5.0

### Minor Changes

- Added browser-safe thinking command helpers so Mastra Code interfaces can share command parsing, model capabilities, and default resolution. ([#22198](https://github.com/mastra-ai/mastra/pull/22198))

  ```ts
  import { parseThinkCommand, resolveDefaultThinkingLevel } from '@mastra/code-sdk/thinking';

  const action = parseThinkCommand('high');
  const fallback = resolveDefaultThinkingLevel({ globalDefault: 'medium', modeDefaults: { plan: 'high' } }, 'plan');
  ```

- Made language-server (LSP) support opt-in in Mastra Code. By default Mastra Code no longer checks for LSP dependencies, starts language servers, or offers the lsp_inspect tool to the agent. Turn it on by adding "lsp": true (or an LSP config object) to your settings.json; "lsp": false is now also accepted and preserved. ([#22126](https://github.com/mastra-ai/mastra/pull/22126))

- Added Parallel as a configured web search provider in Mastra Code, alongside Tavily. Set PARALLEL_API_KEY to enable Parallel-backed web_search and web_extract tools, and pick your default provider in the TUI under /settings → Web search provider (providers are selectable only while their API key is configured; Auto uses the first configured key). ([#22216](https://github.com/mastra-ai/mastra/pull/22216))

  ```bash
  PARALLEL_API_KEY=your-api-key npx mastracode --prompt "Use web_search to find the latest Mastra release"
  ```

- Factory sessions now get a real thread name on their first turn. Mastra's built-in title generation is enabled for them, so a thread is named from the first exchange with the same cheap model the observational-memory observer uses. ([#22156](https://github.com/mastra-ai/mastra/pull/22156))

  Before, a factory session kept whatever name it was created with — the raw first prompt, or nothing at all for work sessions, which fell back to showing their branch — until the observer got far enough into the conversation to name it. Naming now happens on the first turn; the observer still refines it as the thread grows.

  TUI sessions are unchanged: they keep being named by the observer, and pay for no extra call.

### Patch Changes

- Workspace no longer registers the lsp_inspect tool when LSP is not active, so agents are only offered the tool when it can actually run. ([#22126](https://github.com/mastra-ai/mastra/pull/22126))

- Add a `/context` command (alias `/ctx`) to Mastra Code that reports what is occupying the context window. ([#22131](https://github.com/mastra-ai/mastra/pull/22131))

  The report separates the startup context — system prompt, AGENTS.md/CLAUDE.md instructions with their source paths, the skills catalog, and MCP tool definitions rolled up per server — from context that accumulates during the session, namely the conversation itself and any observation memory injected into it. Each line carries an estimated token count and its share of the audited total, so it is possible to see which server, instruction file, or skill set is worth pruning.

  The audit reports only sizes and labels, never the audited content, and is printed to the terminal without being added to the conversation, so running it does not enlarge the context it describes.

  To support exact measurement, `@mastra/core` now exports `formatSkillsCatalog`, the pure formatter behind the skills processor's `<available_skills>` block, and `@mastra/code-sdk` exposes the assembled system prompt as labeled sections.

- Updated dependencies [[`79f04a7`](https://github.com/mastra-ai/mastra/commit/79f04a7f6c6829da541139f638f2f1d267916e08), [`65edab1`](https://github.com/mastra-ai/mastra/commit/65edab1c233d17b8f163bad12fca410d0e6f16b1), [`db6940e`](https://github.com/mastra-ai/mastra/commit/db6940ea63b76df2bc0a7c105a493342b9eaf0ec), [`1e47b75`](https://github.com/mastra-ai/mastra/commit/1e47b7520cab4cfaa8daed52f17e2e6d14ff7539), [`ab20a38`](https://github.com/mastra-ai/mastra/commit/ab20a38d0275f8d85e0f3833bd87ef487bcc609f), [`856b743`](https://github.com/mastra-ai/mastra/commit/856b7431a20393f876ce634dcf7dd4961b124b14), [`fd4d5fe`](https://github.com/mastra-ai/mastra/commit/fd4d5fe4f943699b85db5e74404f190d5a6b8c2a), [`c5eaec5`](https://github.com/mastra-ai/mastra/commit/c5eaec5a860d80d0e3805e67db0414b87ac8cbed), [`ae8790c`](https://github.com/mastra-ai/mastra/commit/ae8790c4bfaa088d2ab279d1dcc06f326b9fd109), [`2c85f42`](https://github.com/mastra-ai/mastra/commit/2c85f428e04ccd63ea31a7ec80b5b327afdad555), [`11bbeb9`](https://github.com/mastra-ai/mastra/commit/11bbeb9b108ef2264e05acefc6dafb9cbb342921), [`48ef1f1`](https://github.com/mastra-ai/mastra/commit/48ef1f1d24eedafbb07f64e659a81b52b67b8bf6), [`aa3a85d`](https://github.com/mastra-ai/mastra/commit/aa3a85daf094c683bb97efdf4b6a696d2e474af5), [`15f92d0`](https://github.com/mastra-ai/mastra/commit/15f92d02bcacac7506346709d88b8bf11ae11695), [`d29d06f`](https://github.com/mastra-ai/mastra/commit/d29d06fe00bbd35b4571150ea04c59d2ed783c71), [`f9172b3`](https://github.com/mastra-ai/mastra/commit/f9172b35de085f9101348eeb60d7d4712505ed8f), [`e737014`](https://github.com/mastra-ai/mastra/commit/e737014e0fc7035759762bb5b48baef1d6c0f6a7), [`dfb7efa`](https://github.com/mastra-ai/mastra/commit/dfb7efa19e348b5a788be2d954362cbae12379d6), [`e6516df`](https://github.com/mastra-ai/mastra/commit/e6516dfcdae4f4ac0e7971d84359a81385ee602f), [`1a485f3`](https://github.com/mastra-ai/mastra/commit/1a485f3538f5ec64d58bd8b5e1e99de0c695c87b), [`0d37487`](https://github.com/mastra-ai/mastra/commit/0d37487d9f349388a3f1cef6a536cf9dcc4b6273), [`8661d7d`](https://github.com/mastra-ai/mastra/commit/8661d7d7179f0a024456aabdd8679bcecd09ac28), [`dbbfeb8`](https://github.com/mastra-ai/mastra/commit/dbbfeb85ec949dc9ebc0755e1ad262e4f5eba8db), [`575e343`](https://github.com/mastra-ai/mastra/commit/575e343900451021d96110916497d334af7bc252), [`0b2a3d1`](https://github.com/mastra-ai/mastra/commit/0b2a3d1783875c5b97b7b36ab3d03d7360e0dde7), [`8661d7d`](https://github.com/mastra-ai/mastra/commit/8661d7d7179f0a024456aabdd8679bcecd09ac28), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`3cc9d00`](https://github.com/mastra-ai/mastra/commit/3cc9d00b2b4333e0377a5e9df5eff92c17ce7630), [`cacb839`](https://github.com/mastra-ai/mastra/commit/cacb8392d9e74189b56d857290b0615f98a2683d), [`57de7d6`](https://github.com/mastra-ai/mastra/commit/57de7d644ba7146edb4e9e6111ec4fa98c3a59e9), [`c8e4cea`](https://github.com/mastra-ai/mastra/commit/c8e4ceac9a390d78c8327dff3cdb2861dd71957f), [`ed01e9a`](https://github.com/mastra-ai/mastra/commit/ed01e9a807514a904374bf687a7b8f18750f6f78), [`b47b26e`](https://github.com/mastra-ai/mastra/commit/b47b26e6fe95cb8a3482be2c5e52de157fe59d0b), [`0d37487`](https://github.com/mastra-ai/mastra/commit/0d37487d9f349388a3f1cef6a536cf9dcc4b6273), [`8661d7d`](https://github.com/mastra-ai/mastra/commit/8661d7d7179f0a024456aabdd8679bcecd09ac28), [`733a537`](https://github.com/mastra-ai/mastra/commit/733a537489a858b5880b2e98809334fba895a221), [`e8e299c`](https://github.com/mastra-ai/mastra/commit/e8e299cc6abdfc39947e2fec25803493015d3882), [`edfc548`](https://github.com/mastra-ai/mastra/commit/edfc548886bc7bae17b681f8b6b41a47eb32bcd2), [`d55807c`](https://github.com/mastra-ai/mastra/commit/d55807cb9f080f3f5d1db06aca02b8fe0992507e), [`b05f486`](https://github.com/mastra-ai/mastra/commit/b05f48612984d5fe2447ea2d6cdd5c604d285b97), [`a981e66`](https://github.com/mastra-ai/mastra/commit/a981e662ed8fc476292375d135cb14a2681efedf), [`a8a4871`](https://github.com/mastra-ai/mastra/commit/a8a4871215f51da95c47129602157ce5372f634a), [`ee0c1a0`](https://github.com/mastra-ai/mastra/commit/ee0c1a097de3acebe7dfc8c136479d4cb5b5b451), [`4bc0650`](https://github.com/mastra-ai/mastra/commit/4bc0650a49114480bf9b5bd318d679941f726823), [`eb9ecaa`](https://github.com/mastra-ai/mastra/commit/eb9ecaa89c36e889749e3b825cfc507ce7f7980b), [`befbfc2`](https://github.com/mastra-ai/mastra/commit/befbfc260d5ec5ece7cdb65a80e94292f428d4c9), [`4ff3ee2`](https://github.com/mastra-ai/mastra/commit/4ff3ee2bff7ed07528b4817f8f49639031c72a4d), [`c7d2ac2`](https://github.com/mastra-ai/mastra/commit/c7d2ac245e6e549f3ee8b6c019fd43fd352fb528), [`e6c3c14`](https://github.com/mastra-ai/mastra/commit/e6c3c14c27fe0b46137c9593b1ad81df1cb46d72), [`9207dfa`](https://github.com/mastra-ai/mastra/commit/9207dfab8062e5fc68b751684797ff86fe0b4e70), [`13c2f97`](https://github.com/mastra-ai/mastra/commit/13c2f979a63ee441834ad0d947b40a82010afb59), [`5165cdc`](https://github.com/mastra-ai/mastra/commit/5165cdcdcf50e144bb8113278535196cc9b07065), [`e737014`](https://github.com/mastra-ai/mastra/commit/e737014e0fc7035759762bb5b48baef1d6c0f6a7), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`f591643`](https://github.com/mastra-ai/mastra/commit/f591643becdf0be9bddce6ba1748e64bc30d77f1), [`63796ba`](https://github.com/mastra-ai/mastra/commit/63796ba0fda60253be17535e68f6bbbf1e6ffa09), [`b1ad324`](https://github.com/mastra-ai/mastra/commit/b1ad324d657f3544b0701332aef7eb10e9a36258), [`61c566d`](https://github.com/mastra-ai/mastra/commit/61c566dd2f2cde2b23ed8f139924e530d4202214), [`9a3d352`](https://github.com/mastra-ai/mastra/commit/9a3d352a5ba0c2a9e4f7a9cc4f028a393bc74306), [`c24754c`](https://github.com/mastra-ai/mastra/commit/c24754c1fb6fe144e5051e536e98c8a18b0214ac), [`12c61d2`](https://github.com/mastra-ai/mastra/commit/12c61d280c8cb208bc3c8dbcbe5dcc60cf9d1cd0), [`bbd4486`](https://github.com/mastra-ai/mastra/commit/bbd4486b7296d6fd0de7177344f87fbbc0bb4fff), [`ae2dc20`](https://github.com/mastra-ai/mastra/commit/ae2dc201dbb48466c3cf77e3d4ef04826132b2db), [`9c984f9`](https://github.com/mastra-ai/mastra/commit/9c984f9152c0ded45453f21cb1f517fe12f8beae), [`c46eb09`](https://github.com/mastra-ai/mastra/commit/c46eb09ce4987509af57a0ac582c61241a6dd2f1), [`9ee8120`](https://github.com/mastra-ai/mastra/commit/9ee8120ce17f76b9f617489e05a283353742690a), [`cd7683d`](https://github.com/mastra-ai/mastra/commit/cd7683d3040bc322ec6f6efb6f9c1e8e40f062a1), [`e737014`](https://github.com/mastra-ai/mastra/commit/e737014e0fc7035759762bb5b48baef1d6c0f6a7), [`d975e92`](https://github.com/mastra-ai/mastra/commit/d975e924d4936f46c386bd3dee39c671720289f6), [`45dd6ee`](https://github.com/mastra-ai/mastra/commit/45dd6ee089bd7df0d0c98a10098e483fd388e04a), [`4e9a228`](https://github.com/mastra-ai/mastra/commit/4e9a2283d5fd6ed1b70a2751eb3dc2cbf82ada20), [`d6ce34a`](https://github.com/mastra-ai/mastra/commit/d6ce34aeceb06ddf3d595a1eed5cc74f481a46a1), [`f95f468`](https://github.com/mastra-ai/mastra/commit/f95f468cf1e7c2b924a13826494f98b8f2ccd581), [`30ed33e`](https://github.com/mastra-ai/mastra/commit/30ed33ee14084a26019aba15fceadda6d6ddefaf), [`cb0291c`](https://github.com/mastra-ai/mastra/commit/cb0291cca0f8a769495375ff213cbda2512bb542), [`04a815f`](https://github.com/mastra-ai/mastra/commit/04a815fc8971d29e97fcdcc5008a1eb472fc00ff), [`1cfa878`](https://github.com/mastra-ai/mastra/commit/1cfa8784d8da0dfaa0317e5048bc48b6084a5ea5), [`997cf5b`](https://github.com/mastra-ai/mastra/commit/997cf5bb3fc600b30aa20e048b663e48e0e1305a), [`9a12ef3`](https://github.com/mastra-ai/mastra/commit/9a12ef3fccf3f4186db0f294f4ee1f02cf4d8db2), [`db6940e`](https://github.com/mastra-ai/mastra/commit/db6940ea63b76df2bc0a7c105a493342b9eaf0ec), [`32d3583`](https://github.com/mastra-ai/mastra/commit/32d358332cb8ac2306b83b73cf3536e74dbd435e), [`7960688`](https://github.com/mastra-ai/mastra/commit/7960688828e04eaf3106e34f7758fa580257eef6), [`91ad69d`](https://github.com/mastra-ai/mastra/commit/91ad69d64994c89199b0c55399e64ed91c61df2f), [`c4e2364`](https://github.com/mastra-ai/mastra/commit/c4e2364742bc37beebfa995db2d42efce6cfc7b8), [`8dc408d`](https://github.com/mastra-ai/mastra/commit/8dc408d34438f9e13297f792c11a5cfd6cf952e1), [`c92def1`](https://github.com/mastra-ai/mastra/commit/c92def10a13c822972c96f0a4ca6ffc1f4258aed), [`63041eb`](https://github.com/mastra-ai/mastra/commit/63041eb4c50b520a0a80e03d4cd6ea99f67715a0), [`c118318`](https://github.com/mastra-ai/mastra/commit/c1183181c9804303db4b511c2e2648f8b714712b), [`c5eaec5`](https://github.com/mastra-ai/mastra/commit/c5eaec5a860d80d0e3805e67db0414b87ac8cbed), [`fc07c64`](https://github.com/mastra-ai/mastra/commit/fc07c6465043e08e99193a6751a01c56ffc2e7a1), [`cced745`](https://github.com/mastra-ai/mastra/commit/cced745a056ec2225c5bc702e32d848847aa8b65), [`542dee2`](https://github.com/mastra-ai/mastra/commit/542dee254167f974ff8cbbbfc0ce10f9a2616a7b), [`b05f486`](https://github.com/mastra-ai/mastra/commit/b05f48612984d5fe2447ea2d6cdd5c604d285b97), [`3c19dce`](https://github.com/mastra-ai/mastra/commit/3c19dcef8e73062a80627a4927eae3ec11145afd), [`aca2869`](https://github.com/mastra-ai/mastra/commit/aca2869b2031982f3c4a2f52525c9be7cf123ef8), [`8dcd635`](https://github.com/mastra-ai/mastra/commit/8dcd6357f0d9557cebc727d7abc6901af6231e4f), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`e6f8450`](https://github.com/mastra-ai/mastra/commit/e6f845074d478527026b18d85031b23353e1d0a4), [`895e9df`](https://github.com/mastra-ai/mastra/commit/895e9dfc17d6f34299eca64e317ded9e5f5e5ef8), [`e66b2ba`](https://github.com/mastra-ai/mastra/commit/e66b2ba100db63eaeab6e21e1ea34b113f2ec781), [`3e8727e`](https://github.com/mastra-ai/mastra/commit/3e8727e11ec1a5d733acedb5c872896394be18c1)]:
  - @mastra/core@1.62.0
  - @mastra/libsql@1.22.0
  - @mastra/parallel@0.1.0
  - @mastra/pg@1.22.0
  - @mastra/github-signals@0.3.0
  - @mastra/duckdb@1.6.3
  - @mastra/mcp@1.17.2
  - @mastra/memory@1.28.0
  - @mastra/fastembed@1.3.0
  - @mastra/observability@1.17.2

## 1.5.0-alpha.12

### Patch Changes

- Updated dependencies [[`48ef1f1`](https://github.com/mastra-ai/mastra/commit/48ef1f1d24eedafbb07f64e659a81b52b67b8bf6), [`63796ba`](https://github.com/mastra-ai/mastra/commit/63796ba0fda60253be17535e68f6bbbf1e6ffa09), [`3c19dce`](https://github.com/mastra-ai/mastra/commit/3c19dcef8e73062a80627a4927eae3ec11145afd)]:
  - @mastra/core@1.62.0-alpha.12

## 1.5.0-alpha.11

### Patch Changes

- Updated dependencies [[`15f92d0`](https://github.com/mastra-ai/mastra/commit/15f92d02bcacac7506346709d88b8bf11ae11695), [`4ff3ee2`](https://github.com/mastra-ai/mastra/commit/4ff3ee2bff7ed07528b4817f8f49639031c72a4d), [`c24754c`](https://github.com/mastra-ai/mastra/commit/c24754c1fb6fe144e5051e536e98c8a18b0214ac), [`cd7683d`](https://github.com/mastra-ai/mastra/commit/cd7683d3040bc322ec6f6efb6f9c1e8e40f062a1), [`45dd6ee`](https://github.com/mastra-ai/mastra/commit/45dd6ee089bd7df0d0c98a10098e483fd388e04a), [`32d3583`](https://github.com/mastra-ai/mastra/commit/32d358332cb8ac2306b83b73cf3536e74dbd435e), [`aca2869`](https://github.com/mastra-ai/mastra/commit/aca2869b2031982f3c4a2f52525c9be7cf123ef8)]:
  - @mastra/github-signals@0.3.0-alpha.0
  - @mastra/core@1.62.0-alpha.11
  - @mastra/memory@1.28.0-alpha.4

## 1.5.0-alpha.10

### Minor Changes

- Added Parallel as a configured web search provider in Mastra Code, alongside Tavily. Set PARALLEL_API_KEY to enable Parallel-backed web_search and web_extract tools, and pick your default provider in the TUI under /settings → Web search provider (providers are selectable only while their API key is configured; Auto uses the first configured key). ([#22216](https://github.com/mastra-ai/mastra/pull/22216))

  ```bash
  PARALLEL_API_KEY=your-api-key npx mastracode --prompt "Use web_search to find the latest Mastra release"
  ```

### Patch Changes

- Updated dependencies [[`b05f486`](https://github.com/mastra-ai/mastra/commit/b05f48612984d5fe2447ea2d6cdd5c604d285b97), [`4bc0650`](https://github.com/mastra-ai/mastra/commit/4bc0650a49114480bf9b5bd318d679941f726823), [`7960688`](https://github.com/mastra-ai/mastra/commit/7960688828e04eaf3106e34f7758fa580257eef6), [`b05f486`](https://github.com/mastra-ai/mastra/commit/b05f48612984d5fe2447ea2d6cdd5c604d285b97)]:
  - @mastra/core@1.62.0-alpha.10
  - @mastra/fastembed@1.3.0-alpha.0
  - @mastra/observability@1.17.2-alpha.2
  - @mastra/mcp@1.17.2-alpha.2

## 1.5.0-alpha.9

### Patch Changes

- Updated dependencies [[`eb9ecaa`](https://github.com/mastra-ai/mastra/commit/eb9ecaa89c36e889749e3b825cfc507ce7f7980b), [`3e8727e`](https://github.com/mastra-ai/mastra/commit/3e8727e11ec1a5d733acedb5c872896394be18c1)]:
  - @mastra/core@1.62.0-alpha.9

## 1.5.0-alpha.8

### Minor Changes

- Factory sessions now get a real thread name on their first turn. Mastra's built-in title generation is enabled for them, so a thread is named from the first exchange with the same cheap model the observational-memory observer uses. ([#22156](https://github.com/mastra-ai/mastra/pull/22156))

  Before, a factory session kept whatever name it was created with — the raw first prompt, or nothing at all for work sessions, which fell back to showing their branch — until the observer got far enough into the conversation to name it. Naming now happens on the first turn; the observer still refines it as the thread grows.

  TUI sessions are unchanged: they keep being named by the observer, and pay for no extra call.

### Patch Changes

- Updated dependencies [[`aa3a85d`](https://github.com/mastra-ai/mastra/commit/aa3a85daf094c683bb97efdf4b6a696d2e474af5), [`d29d06f`](https://github.com/mastra-ai/mastra/commit/d29d06fe00bbd35b4571150ea04c59d2ed783c71), [`e6516df`](https://github.com/mastra-ai/mastra/commit/e6516dfcdae4f4ac0e7971d84359a81385ee602f), [`0b2a3d1`](https://github.com/mastra-ai/mastra/commit/0b2a3d1783875c5b97b7b36ab3d03d7360e0dde7), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`57de7d6`](https://github.com/mastra-ai/mastra/commit/57de7d644ba7146edb4e9e6111ec4fa98c3a59e9), [`e8e299c`](https://github.com/mastra-ai/mastra/commit/e8e299cc6abdfc39947e2fec25803493015d3882), [`edfc548`](https://github.com/mastra-ai/mastra/commit/edfc548886bc7bae17b681f8b6b41a47eb32bcd2), [`a8a4871`](https://github.com/mastra-ai/mastra/commit/a8a4871215f51da95c47129602157ce5372f634a), [`c7d2ac2`](https://github.com/mastra-ai/mastra/commit/c7d2ac245e6e549f3ee8b6c019fd43fd352fb528), [`e6c3c14`](https://github.com/mastra-ai/mastra/commit/e6c3c14c27fe0b46137c9593b1ad81df1cb46d72), [`5165cdc`](https://github.com/mastra-ai/mastra/commit/5165cdcdcf50e144bb8113278535196cc9b07065), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`bbd4486`](https://github.com/mastra-ai/mastra/commit/bbd4486b7296d6fd0de7177344f87fbbc0bb4fff), [`9c984f9`](https://github.com/mastra-ai/mastra/commit/9c984f9152c0ded45453f21cb1f517fe12f8beae), [`9ee8120`](https://github.com/mastra-ai/mastra/commit/9ee8120ce17f76b9f617489e05a283353742690a), [`d975e92`](https://github.com/mastra-ai/mastra/commit/d975e924d4936f46c386bd3dee39c671720289f6), [`1cfa878`](https://github.com/mastra-ai/mastra/commit/1cfa8784d8da0dfaa0317e5048bc48b6084a5ea5), [`c118318`](https://github.com/mastra-ai/mastra/commit/c1183181c9804303db4b511c2e2648f8b714712b), [`fc07c64`](https://github.com/mastra-ai/mastra/commit/fc07c6465043e08e99193a6751a01c56ffc2e7a1), [`542dee2`](https://github.com/mastra-ai/mastra/commit/542dee254167f974ff8cbbbfc0ce10f9a2616a7b), [`8dcd635`](https://github.com/mastra-ai/mastra/commit/8dcd6357f0d9557cebc727d7abc6901af6231e4f), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`895e9df`](https://github.com/mastra-ai/mastra/commit/895e9dfc17d6f34299eca64e317ded9e5f5e5ef8)]:
  - @mastra/core@1.62.0-alpha.8
  - @mastra/libsql@1.22.0-alpha.2
  - @mastra/pg@1.22.0-alpha.4
  - @mastra/memory@1.28.0-alpha.3

## 1.5.0-alpha.7

### Minor Changes

- Added browser-safe thinking command helpers so Mastra Code interfaces can share command parsing, model capabilities, and default resolution. ([#22198](https://github.com/mastra-ai/mastra/pull/22198))

  ```ts
  import { parseThinkCommand, resolveDefaultThinkingLevel } from '@mastra/code-sdk/thinking';

  const action = parseThinkCommand('high');
  const fallback = resolveDefaultThinkingLevel({ globalDefault: 'medium', modeDefaults: { plan: 'high' } }, 'plan');
  ```

### Patch Changes

- Updated dependencies [[`db6940e`](https://github.com/mastra-ai/mastra/commit/db6940ea63b76df2bc0a7c105a493342b9eaf0ec), [`ae8790c`](https://github.com/mastra-ai/mastra/commit/ae8790c4bfaa088d2ab279d1dcc06f326b9fd109), [`dfb7efa`](https://github.com/mastra-ai/mastra/commit/dfb7efa19e348b5a788be2d954362cbae12379d6), [`ee0c1a0`](https://github.com/mastra-ai/mastra/commit/ee0c1a097de3acebe7dfc8c136479d4cb5b5b451), [`befbfc2`](https://github.com/mastra-ai/mastra/commit/befbfc260d5ec5ece7cdb65a80e94292f428d4c9), [`04a815f`](https://github.com/mastra-ai/mastra/commit/04a815fc8971d29e97fcdcc5008a1eb472fc00ff), [`db6940e`](https://github.com/mastra-ai/mastra/commit/db6940ea63b76df2bc0a7c105a493342b9eaf0ec), [`cced745`](https://github.com/mastra-ai/mastra/commit/cced745a056ec2225c5bc702e32d848847aa8b65)]:
  - @mastra/libsql@1.22.0-alpha.1
  - @mastra/core@1.62.0-alpha.7
  - @mastra/mcp@1.17.2-alpha.2
  - @mastra/memory@1.28.0-alpha.2

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
