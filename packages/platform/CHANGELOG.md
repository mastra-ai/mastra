# @mastra/platform

## 0.1.1

### Patch Changes

- `PlatformKnowledge` now reads `MASTRA_KNOWLEDGE_ACCESS_TOKEN` when it is set, ahead of `MASTRA_PLATFORM_ACCESS_TOKEN` and `MASTRA_PLATFORM_SECRET_KEY`. An explicit `accessToken` option still wins. An empty `MASTRA_KNOWLEDGE_ACCESS_TOKEN` is ignored. This is a Knowledge-only credential, so an app can authenticate to Knowledge without the general Platform token. ([#30765](https://github.com/mastra-ai/mastra/pull/30765))

  Set the credential and instance ID in your environment:

  ```sh
  export MASTRA_KNOWLEDGE_ACCESS_TOKEN='your-knowledge-token'
  export MASTRA_KNOWLEDGE_INSTANCE_ID='your-knowledge-instance-id'
  ```

  ```ts
  import { PlatformKnowledge } from '@mastra/platform';

  const knowledge = new PlatformKnowledge();
  ```

- `PlatformKnowledge` now registers under the stable id `platform-knowledge-<instanceId>` (was random per boot), so two instances with different instance IDs still register side by side, and a missing instance ID now fails at construction with its own error naming `MASTRA_KNOWLEDGE_INSTANCE_ID`. ([#30757](https://github.com/mastra-ai/mastra/pull/30757))

- Updated dependencies [[`10484e3`](https://github.com/mastra-ai/mastra/commit/10484e3b5544f0a160bc28446e4584be1a32c8e5), [`0410aad`](https://github.com/mastra-ai/mastra/commit/0410aadf076536e3318b06b9ee493d70c3ef271f), [`a094a96`](https://github.com/mastra-ai/mastra/commit/a094a964cca2477f6fdaea8e4224666990331c14), [`998939a`](https://github.com/mastra-ai/mastra/commit/998939acc06a9d10f0c0aba21a36d3d21c8a08a3), [`7dd73e5`](https://github.com/mastra-ai/mastra/commit/7dd73e52417f6f438a37d24bdad6e6a2493d76b2), [`9b7df85`](https://github.com/mastra-ai/mastra/commit/9b7df85172170dd1f92bbb1343ae375d464334af), [`732a6a9`](https://github.com/mastra-ai/mastra/commit/732a6a9a831ca0a523188458c927d60068651119), [`ac63b9c`](https://github.com/mastra-ai/mastra/commit/ac63b9cc80f26f1d09901d9626a476555e294963), [`08faca4`](https://github.com/mastra-ai/mastra/commit/08faca458e39ab0b87e8597f75b6f1a7979a8599), [`3724a2e`](https://github.com/mastra-ai/mastra/commit/3724a2eb71acd0832938dcf25f428fa34237503c), [`b9d38c7`](https://github.com/mastra-ai/mastra/commit/b9d38c73982210c6564ee8a33d992a238e29a20b), [`192bb52`](https://github.com/mastra-ai/mastra/commit/192bb5225e53032dc1bd1e3ff861526861a62586), [`ab2295f`](https://github.com/mastra-ai/mastra/commit/ab2295fc158d6c107eb8459c648ad7293ba2af8e), [`e8a81e0`](https://github.com/mastra-ai/mastra/commit/e8a81e0919d9d8f75f85909178c637c708edc1d5), [`5564da0`](https://github.com/mastra-ai/mastra/commit/5564da07d1f09c551a7a0c3749dd8ad7281be2d1), [`00e2a36`](https://github.com/mastra-ai/mastra/commit/00e2a36a63153763efef33dee69753be5cdc85f0)]:
  - @mastra/core@1.85.0

## 0.1.1-alpha.1

### Patch Changes

- `PlatformKnowledge` now registers under the stable id `platform-knowledge-<instanceId>` (was random per boot), so two instances with different instance IDs still register side by side, and a missing instance ID now fails at construction with its own error naming `MASTRA_KNOWLEDGE_INSTANCE_ID`. ([#30757](https://github.com/mastra-ai/mastra/pull/30757))

- Updated dependencies [[`e8a81e0`](https://github.com/mastra-ai/mastra/commit/e8a81e0919d9d8f75f85909178c637c708edc1d5)]:
  - @mastra/core@1.85.0-alpha.2

## 0.1.1-alpha.0

### Patch Changes

- `PlatformKnowledge` now reads `MASTRA_KNOWLEDGE_ACCESS_TOKEN` when it is set, ahead of `MASTRA_PLATFORM_ACCESS_TOKEN` and `MASTRA_PLATFORM_SECRET_KEY`. An explicit `accessToken` option still wins, and an empty value is ignored. This is a Knowledge-only credential, so an app can authenticate to Knowledge without the general Platform token. ([#30765](https://github.com/mastra-ai/mastra/pull/30765))

- Updated dependencies [[`9b7df85`](https://github.com/mastra-ai/mastra/commit/9b7df85172170dd1f92bbb1343ae375d464334af), [`732a6a9`](https://github.com/mastra-ai/mastra/commit/732a6a9a831ca0a523188458c927d60068651119), [`ab2295f`](https://github.com/mastra-ai/mastra/commit/ab2295fc158d6c107eb8459c648ad7293ba2af8e)]:
  - @mastra/core@1.85.0-alpha.1

## 0.1.0

### Minor Changes

- Added `PlatformBrowser`, a Stagehand browser backed by a Mastra Platform browser session. By default it provisions a session with `POST /v1/browsers/sessions` on the Platform and connects to the returned CDP URL; pass `cdpUrl` to connect to a session you already provisioned, with no token or API call. The access token falls back to `MASTRA_PLATFORM_ACCESS_TOKEN` / `MASTRA_PLATFORM_SECRET_KEY`, the project to `MASTRA_PROJECT_ID`, and the API URL to `MASTRA_BROWSER_API_URL`. `@mastra/platform` now depends on `@mastra/stagehand` at runtime. ([#29428](https://github.com/mastra-ai/mastra/pull/29428))

  ```ts
  import { PlatformBrowser } from '@mastra/platform';

  const agent = new Agent({ name: 'browser-agent', model, browser: new PlatformBrowser() });
  ```

- Added `@mastra/platform`: hosted Mastra Platform Memory and Knowledge clients, with Platform Sandbox and Filesystem re-exported from `@mastra/platform-workspace`. `PlatformMemory` is a drop-in `memory` for `Agent` that loads observations and recent messages from a Platform Memory instance and saves each turn back; observation and reflection run on the Platform. `PlatformMemoryClient` exposes the same API directly. Credentials fall back to `MASTRA_PLATFORM_ACCESS_TOKEN` / `MASTRA_PLATFORM_SECRET_KEY`. `PlatformMemory` uses `MASTRA_MEMORY_INSTANCE_ID`; `PlatformKnowledge` uses `MASTRA_KNOWLEDGE_INSTANCE_ID`. `PlatformKnowledge` takes every scope declaration and access rule from its instance, Memory's and Platform importers' included, and has no `scopes` option. Agents read imported pages when their runs hold the scope an importer's rule grants (for now `imports:all`). ([#29428](https://github.com/mastra-ai/mastra/pull/29428))

  ```ts
  import { PlatformMemory, PlatformKnowledge, PlatformSandbox, PlatformFilesystem } from '@mastra/platform';

  const agent = new Agent({ name: 'assistant', model, memory: new PlatformMemory() });
  ```

### Patch Changes

- `PlatformKnowledge` now supports listing pins: `knowledge_pin` with `kind: 'list'` pins a page's listing on hosted Knowledge instead of refusing it as an old storage adapter. ([#29428](https://github.com/mastra-ai/mastra/pull/29428))

- `PlatformMemory` fixes for read-only runs and working memory: ([#29428](https://github.com/mastra-ai/mastra/pull/29428))

  - A read-only run (`memory: { options: { readOnly: true } }`) now sees the thread's observations and unobserved messages, read through the Memory instance's read-only context route. Before, it got no stored context at all. It still saves nothing and starts no observation.
  - The `workingMemory` option now delivers what it says: `readonly` and `tool` add the resource's stored working memory to each run's prompt, read fresh each run; `tool` also tells the agent to update it with `updateWorkingMemory`; `off` leaves it out. Before, stored working memory never reached the prompt in any mode.

- Updated dependencies [[`7277766`](https://github.com/mastra-ai/mastra/commit/7277766d6c967c475675d58ff2d0e5c6d7be7c84), [`5053f97`](https://github.com/mastra-ai/mastra/commit/5053f97664afec569f908f266e04865cbae51868), [`88b4a97`](https://github.com/mastra-ai/mastra/commit/88b4a970426f48731a153e46ed228d0301da32a1), [`33eaa29`](https://github.com/mastra-ai/mastra/commit/33eaa293e28aa8cd86ad68e1eaf44b4929be818d), [`1bac054`](https://github.com/mastra-ai/mastra/commit/1bac054f7a9089d112f2b4732caef0fe9801df71), [`f51098e`](https://github.com/mastra-ai/mastra/commit/f51098e60cbb47a9eac5e458d6d85cd4ef162926), [`51c340a`](https://github.com/mastra-ai/mastra/commit/51c340a7824530b348e157cb6f71094522e2b5c2), [`2788a6d`](https://github.com/mastra-ai/mastra/commit/2788a6d959ec16c454d1ac6564d546f47be8f1eb), [`8ce66cf`](https://github.com/mastra-ai/mastra/commit/8ce66cf4a19e23d5bd73cd861465d89bd0ee8065), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`51c340a`](https://github.com/mastra-ai/mastra/commit/51c340a7824530b348e157cb6f71094522e2b5c2), [`88f94f2`](https://github.com/mastra-ai/mastra/commit/88f94f237acc406efb774367f5ba7bdeaac8e88d), [`7517474`](https://github.com/mastra-ai/mastra/commit/7517474b395a44ca6b7573a16d307ca7964ab3a8), [`bf60feb`](https://github.com/mastra-ai/mastra/commit/bf60feb162e5a4482a7c6767d14a17f9dce212a8), [`7fd6830`](https://github.com/mastra-ai/mastra/commit/7fd6830a26ac38060fa02675b2daef82f2c0ef2e), [`99ec3bd`](https://github.com/mastra-ai/mastra/commit/99ec3bd582a79d85d4c0c09b50ed9ed0830c79d5), [`70f3eba`](https://github.com/mastra-ai/mastra/commit/70f3eba5ecb9870d21582455fb55137663766d50), [`7518c05`](https://github.com/mastra-ai/mastra/commit/7518c05d6f24d37ccebed2a0667e6fe189c3c368), [`b07dd23`](https://github.com/mastra-ai/mastra/commit/b07dd2371304f688a117c441501130853293a14f), [`175b4b5`](https://github.com/mastra-ai/mastra/commit/175b4b5194bd74d82a79c2567aec44ef0cfafa80), [`0eb407e`](https://github.com/mastra-ai/mastra/commit/0eb407ebcce9d87e96cb399df5a3afb265fc2806), [`5266060`](https://github.com/mastra-ai/mastra/commit/5266060ccd0766a14b94109dc4bc9c3d29a1b8f5), [`33fba78`](https://github.com/mastra-ai/mastra/commit/33fba789314c27a9c610095e75f3131ca92831c9), [`cb5f3a5`](https://github.com/mastra-ai/mastra/commit/cb5f3a5c7964e9304c9b2a9141ab971158fe16d4), [`984a8cf`](https://github.com/mastra-ai/mastra/commit/984a8cfd7bc751c3cd4421fb6516482fa863174b), [`8ac8822`](https://github.com/mastra-ai/mastra/commit/8ac88228d67a5b3987084adeb40364a333347c97), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`189c5dd`](https://github.com/mastra-ai/mastra/commit/189c5ddc674843e4fa67ad8bf03c2c1b9ae7b658), [`9abbec6`](https://github.com/mastra-ai/mastra/commit/9abbec671ccf0826550241d1f1c2d7ff89e5b95b), [`6d14d0e`](https://github.com/mastra-ai/mastra/commit/6d14d0edc4fb03e800d8d86e7e7fa00bf3943b56), [`d929736`](https://github.com/mastra-ai/mastra/commit/d9297364354b6a9c5dc0b870c2cea1e305f5faa1), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`e110fa6`](https://github.com/mastra-ai/mastra/commit/e110fa681a156277eed427ecea7a7bf488b02d37), [`7b9130f`](https://github.com/mastra-ai/mastra/commit/7b9130f50ec0d68daae4ef11bbfaf2d3bc9454ed), [`600cb85`](https://github.com/mastra-ai/mastra/commit/600cb853294e2c06f9e6bfd1da8b06de413e48d2), [`0278a5c`](https://github.com/mastra-ai/mastra/commit/0278a5ce834fad3cced73cfd19336a34d1bc8f10), [`d5f3546`](https://github.com/mastra-ai/mastra/commit/d5f35468273369ae7d4699d856f5db69e871c8db), [`bbc22ce`](https://github.com/mastra-ai/mastra/commit/bbc22ce1036a18c3d235a556883844b81fe2fecc), [`d5b0012`](https://github.com/mastra-ai/mastra/commit/d5b00123c6098104eda0eb8d39ef0e139a0fe3e3), [`037b9b7`](https://github.com/mastra-ai/mastra/commit/037b9b75a89388b5ecd7ca72799d29107180f211), [`a86a47c`](https://github.com/mastra-ai/mastra/commit/a86a47c7ef92aa3a48b6663336235a43b7535aaa), [`951a18b`](https://github.com/mastra-ai/mastra/commit/951a18b08571b87eae318bcd0f5970b8e70ca3c8), [`d0a2fa4`](https://github.com/mastra-ai/mastra/commit/d0a2fa4e34473a05a582af70270173747c93a938), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`8559e74`](https://github.com/mastra-ai/mastra/commit/8559e74767d2baf74e29f408e5dfa41a0d1007b0), [`7b646a0`](https://github.com/mastra-ai/mastra/commit/7b646a07a8da8aa84ca2a0a4564369c9d2462af5), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`f4458ee`](https://github.com/mastra-ai/mastra/commit/f4458eea7f221a5b741a4846bba9b95139a8aef8), [`a3b4ef9`](https://github.com/mastra-ai/mastra/commit/a3b4ef9ecda76f961cb9992a2c8787d37d8ce1b3), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`c8a35ac`](https://github.com/mastra-ai/mastra/commit/c8a35ac6243eaef8ef1d9e589a7b75bf44904d8b), [`547600d`](https://github.com/mastra-ai/mastra/commit/547600d004e08ecb8b08c84312b535ae5b016c92), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`8acea4c`](https://github.com/mastra-ai/mastra/commit/8acea4cc5b97dcfd1e1179f9b40ca34c05f255cf), [`1bae2df`](https://github.com/mastra-ai/mastra/commit/1bae2df59020ede9a2a6096e6bf24500b06a0a86), [`4e206cf`](https://github.com/mastra-ai/mastra/commit/4e206cf1d2e486be84e0de9a9c8dbfd8bedeb222)]:
  - @mastra/core@1.84.0
  - @mastra/platform-workspace@1.13.1

## 0.1.0-alpha.1

### Minor Changes

- Added `PlatformBrowser`, a Stagehand browser backed by a Mastra Platform browser session. By default it provisions a session with `POST /v1/browsers/sessions` on the Platform and connects to the returned CDP URL; pass `cdpUrl` to connect to a session you already provisioned, with no token or API call. The access token falls back to `MASTRA_PLATFORM_ACCESS_TOKEN` / `MASTRA_PLATFORM_SECRET_KEY`, the project to `MASTRA_PROJECT_ID`, and the API URL to `MASTRA_BROWSER_API_URL`. `@mastra/platform` now depends on `@mastra/stagehand` at runtime. ([#29428](https://github.com/mastra-ai/mastra/pull/29428))

  ```ts
  import { PlatformBrowser } from '@mastra/platform';

  const agent = new Agent({ name: 'browser-agent', model, browser: new PlatformBrowser() });
  ```

- Added `@mastra/platform`: hosted Mastra Platform Memory and Knowledge clients, with Platform Sandbox and Filesystem re-exported from `@mastra/platform-workspace`. `PlatformMemory` is a drop-in `memory` for `Agent` that loads observations and recent messages from a Platform Memory instance and saves each turn back; observation and reflection run on the Platform. `PlatformMemoryClient` exposes the same API directly. Credentials fall back to `MASTRA_PLATFORM_ACCESS_TOKEN` / `MASTRA_PLATFORM_SECRET_KEY`. `PlatformMemory` uses `MASTRA_MEMORY_INSTANCE_ID`; `PlatformKnowledge` uses `MASTRA_KNOWLEDGE_INSTANCE_ID`. `PlatformKnowledge` takes every scope declaration and access rule from its instance, Memory's and Platform importers' included, and has no `scopes` option. Agents read imported pages when their runs hold the scope an importer's rule grants (for now `imports:all`). ([#29428](https://github.com/mastra-ai/mastra/pull/29428))

  ```ts
  import { PlatformMemory, PlatformKnowledge, PlatformSandbox, PlatformFilesystem } from '@mastra/platform';

  const agent = new Agent({ name: 'assistant', model, memory: new PlatformMemory() });
  ```

### Patch Changes

- `PlatformKnowledge` now supports listing pins: `knowledge_pin` with `kind: 'list'` pins a page's listing on hosted Knowledge instead of refusing it as an old storage adapter. ([#29428](https://github.com/mastra-ai/mastra/pull/29428))

- `PlatformMemory` fixes for read-only runs and working memory: ([#29428](https://github.com/mastra-ai/mastra/pull/29428))

  - A read-only run (`memory: { options: { readOnly: true } }`) now sees the thread's observations and unobserved messages, read through the Memory instance's read-only context route. Before, it got no stored context at all. It still saves nothing and starts no observation.
  - The `workingMemory` option now delivers what it says: `readonly` and `tool` add the resource's stored working memory to each run's prompt, read fresh each run; `tool` also tells the agent to update it with `updateWorkingMemory`; `off` leaves it out. Before, stored working memory never reached the prompt in any mode.

- Updated dependencies [[`0eb407e`](https://github.com/mastra-ai/mastra/commit/0eb407ebcce9d87e96cb399df5a3afb265fc2806)]:
  - @mastra/core@1.84.0-alpha.6

See [release notes](https://github.com/mastra-ai/mastra/releases) for published changes.
