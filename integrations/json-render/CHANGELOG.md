# @mastra/json-render

## 0.2.0-alpha.0

### Minor Changes

- Added `studioCatalog` at `@mastra/json-render/studio`. Agents that compose with it get their interfaces drawn in Studio's chat with Studio's own components, without writing any client code. The catalog covers layout, content, and form controls, and its `sendMessage` action sends the values the user entered back to the agent. ([#31016](https://github.com/mastra-ai/mastra/pull/31016))

  ```typescript
  import { JsonRenderProcessor } from '@mastra/json-render';
  import { studioCatalog } from '@mastra/json-render/studio';

  const ui = new JsonRenderProcessor({ catalog: studioCatalog });

  const agent = new Agent({
    // ...
    instructions: studioCatalog.prompt({ mode: 'inline', editModes: ['patch'] }),
    inputProcessors: [ui],
    outputProcessors: [ui],
  });
  ```

### Patch Changes

- Updated dependencies [[`f35fac5`](https://github.com/mastra-ai/mastra/commit/f35fac5b216214a6fc6407558f94fc2f4cbcc610), [`f2c23af`](https://github.com/mastra-ai/mastra/commit/f2c23af7f751a3e195d7bd52bd0377edb5f9072b), [`50e318b`](https://github.com/mastra-ai/mastra/commit/50e318bd77cc72ac0a148c900bb48b8f0b759b75), [`b008c95`](https://github.com/mastra-ai/mastra/commit/b008c95fa93c5a73ae08c4f86e99d7bd55bf3e78), [`6507fdc`](https://github.com/mastra-ai/mastra/commit/6507fdc6343363bc33eef8e30e83f50c50fc90ab), [`f77bcb1`](https://github.com/mastra-ai/mastra/commit/f77bcb1a5bcdfebda3df4b4adec8e6ac5f5f4e18)]:
  - @mastra/core@1.86.0-alpha.3

## 0.1.0

### Minor Changes

- Added `@mastra/json-render`, which lets agents compose [json-render](https://json-render.dev) interfaces from your component catalog. ([#29914](https://github.com/mastra-ai/mastra/pull/29914))

  ```ts
  import { JsonRenderProcessor } from '@mastra/json-render';

  const ui = new JsonRenderProcessor({ catalog });

  const agent = new Agent({
    id: 'ui-agent',
    name: 'UI Agent',
    model: 'openai/gpt-6.1-sol',
    instructions: catalog.prompt({ mode: 'inline', editModes: ['patch'] }),
    inputProcessors: [ui],
    outputProcessors: [ui],
    maxProcessorRetries: 2,
    memory: new Memory(),
  });
  ```

  - Interfaces the model writes stream to the client as `data-spec` parts, and the reply's text keeps only the prose. Render them with `useJsonRenderMessage()` from `@json-render/react`.
  - Interfaces are saved with the message, so they render again after a reload.
  - Later turns can edit the latest interface with a few patches. Send the interface's state under the `JSON_RENDER_STATE` request context key, and the model sees what the user set and the edit keeps it.
  - Interfaces that don't match the catalog are sent back to the model to fix before they're saved.

### Patch Changes

- Updated dependencies [[`7277766`](https://github.com/mastra-ai/mastra/commit/7277766d6c967c475675d58ff2d0e5c6d7be7c84), [`5053f97`](https://github.com/mastra-ai/mastra/commit/5053f97664afec569f908f266e04865cbae51868), [`88b4a97`](https://github.com/mastra-ai/mastra/commit/88b4a970426f48731a153e46ed228d0301da32a1), [`33eaa29`](https://github.com/mastra-ai/mastra/commit/33eaa293e28aa8cd86ad68e1eaf44b4929be818d), [`1bac054`](https://github.com/mastra-ai/mastra/commit/1bac054f7a9089d112f2b4732caef0fe9801df71), [`f51098e`](https://github.com/mastra-ai/mastra/commit/f51098e60cbb47a9eac5e458d6d85cd4ef162926), [`51c340a`](https://github.com/mastra-ai/mastra/commit/51c340a7824530b348e157cb6f71094522e2b5c2), [`2788a6d`](https://github.com/mastra-ai/mastra/commit/2788a6d959ec16c454d1ac6564d546f47be8f1eb), [`8ce66cf`](https://github.com/mastra-ai/mastra/commit/8ce66cf4a19e23d5bd73cd861465d89bd0ee8065), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`51c340a`](https://github.com/mastra-ai/mastra/commit/51c340a7824530b348e157cb6f71094522e2b5c2), [`88f94f2`](https://github.com/mastra-ai/mastra/commit/88f94f237acc406efb774367f5ba7bdeaac8e88d), [`7517474`](https://github.com/mastra-ai/mastra/commit/7517474b395a44ca6b7573a16d307ca7964ab3a8), [`bf60feb`](https://github.com/mastra-ai/mastra/commit/bf60feb162e5a4482a7c6767d14a17f9dce212a8), [`7fd6830`](https://github.com/mastra-ai/mastra/commit/7fd6830a26ac38060fa02675b2daef82f2c0ef2e), [`99ec3bd`](https://github.com/mastra-ai/mastra/commit/99ec3bd582a79d85d4c0c09b50ed9ed0830c79d5), [`70f3eba`](https://github.com/mastra-ai/mastra/commit/70f3eba5ecb9870d21582455fb55137663766d50), [`7518c05`](https://github.com/mastra-ai/mastra/commit/7518c05d6f24d37ccebed2a0667e6fe189c3c368), [`b07dd23`](https://github.com/mastra-ai/mastra/commit/b07dd2371304f688a117c441501130853293a14f), [`175b4b5`](https://github.com/mastra-ai/mastra/commit/175b4b5194bd74d82a79c2567aec44ef0cfafa80), [`0eb407e`](https://github.com/mastra-ai/mastra/commit/0eb407ebcce9d87e96cb399df5a3afb265fc2806), [`5266060`](https://github.com/mastra-ai/mastra/commit/5266060ccd0766a14b94109dc4bc9c3d29a1b8f5), [`33fba78`](https://github.com/mastra-ai/mastra/commit/33fba789314c27a9c610095e75f3131ca92831c9), [`cb5f3a5`](https://github.com/mastra-ai/mastra/commit/cb5f3a5c7964e9304c9b2a9141ab971158fe16d4), [`984a8cf`](https://github.com/mastra-ai/mastra/commit/984a8cfd7bc751c3cd4421fb6516482fa863174b), [`8ac8822`](https://github.com/mastra-ai/mastra/commit/8ac88228d67a5b3987084adeb40364a333347c97), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`189c5dd`](https://github.com/mastra-ai/mastra/commit/189c5ddc674843e4fa67ad8bf03c2c1b9ae7b658), [`9abbec6`](https://github.com/mastra-ai/mastra/commit/9abbec671ccf0826550241d1f1c2d7ff89e5b95b), [`6d14d0e`](https://github.com/mastra-ai/mastra/commit/6d14d0edc4fb03e800d8d86e7e7fa00bf3943b56), [`d929736`](https://github.com/mastra-ai/mastra/commit/d9297364354b6a9c5dc0b870c2cea1e305f5faa1), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`e110fa6`](https://github.com/mastra-ai/mastra/commit/e110fa681a156277eed427ecea7a7bf488b02d37), [`7b9130f`](https://github.com/mastra-ai/mastra/commit/7b9130f50ec0d68daae4ef11bbfaf2d3bc9454ed), [`0278a5c`](https://github.com/mastra-ai/mastra/commit/0278a5ce834fad3cced73cfd19336a34d1bc8f10), [`d5f3546`](https://github.com/mastra-ai/mastra/commit/d5f35468273369ae7d4699d856f5db69e871c8db), [`bbc22ce`](https://github.com/mastra-ai/mastra/commit/bbc22ce1036a18c3d235a556883844b81fe2fecc), [`d5b0012`](https://github.com/mastra-ai/mastra/commit/d5b00123c6098104eda0eb8d39ef0e139a0fe3e3), [`037b9b7`](https://github.com/mastra-ai/mastra/commit/037b9b75a89388b5ecd7ca72799d29107180f211), [`a86a47c`](https://github.com/mastra-ai/mastra/commit/a86a47c7ef92aa3a48b6663336235a43b7535aaa), [`951a18b`](https://github.com/mastra-ai/mastra/commit/951a18b08571b87eae318bcd0f5970b8e70ca3c8), [`d0a2fa4`](https://github.com/mastra-ai/mastra/commit/d0a2fa4e34473a05a582af70270173747c93a938), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`8559e74`](https://github.com/mastra-ai/mastra/commit/8559e74767d2baf74e29f408e5dfa41a0d1007b0), [`7b646a0`](https://github.com/mastra-ai/mastra/commit/7b646a07a8da8aa84ca2a0a4564369c9d2462af5), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`f4458ee`](https://github.com/mastra-ai/mastra/commit/f4458eea7f221a5b741a4846bba9b95139a8aef8), [`a3b4ef9`](https://github.com/mastra-ai/mastra/commit/a3b4ef9ecda76f961cb9992a2c8787d37d8ce1b3), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`c8a35ac`](https://github.com/mastra-ai/mastra/commit/c8a35ac6243eaef8ef1d9e589a7b75bf44904d8b), [`547600d`](https://github.com/mastra-ai/mastra/commit/547600d004e08ecb8b08c84312b535ae5b016c92), [`929c8ab`](https://github.com/mastra-ai/mastra/commit/929c8aba1e3af7bf246b0e8aecc03264730fb913), [`8acea4c`](https://github.com/mastra-ai/mastra/commit/8acea4cc5b97dcfd1e1179f9b40ca34c05f255cf), [`1bae2df`](https://github.com/mastra-ai/mastra/commit/1bae2df59020ede9a2a6096e6bf24500b06a0a86), [`4e206cf`](https://github.com/mastra-ai/mastra/commit/4e206cf1d2e486be84e0de9a9c8dbfd8bedeb222)]:
  - @mastra/core@1.84.0

## 0.1.0-alpha.0

### Minor Changes

- Added `@mastra/json-render`, which lets agents compose [json-render](https://json-render.dev) interfaces from your component catalog. ([#29914](https://github.com/mastra-ai/mastra/pull/29914))

  ```ts
  import { JsonRenderProcessor } from '@mastra/json-render';

  const ui = new JsonRenderProcessor({ catalog });

  const agent = new Agent({
    id: 'ui-agent',
    name: 'UI Agent',
    model: 'openai/gpt-6.1-sol',
    instructions: catalog.prompt({ mode: 'inline', editModes: ['patch'] }),
    inputProcessors: [ui],
    outputProcessors: [ui],
    maxProcessorRetries: 2,
    memory: new Memory(),
  });
  ```

  - Interfaces the model writes stream to the client as `data-spec` parts, and the reply's text keeps only the prose. Render them with `useJsonRenderMessage()` from `@json-render/react`.
  - Interfaces are saved with the message, so they render again after a reload.
  - Later turns can edit the latest interface with a few patches. Send the interface's state under the `JSON_RENDER_STATE` request context key, and the model sees what the user set and the edit keeps it.
  - Interfaces that don't match the catalog are sent back to the model to fix before they're saved.

### Patch Changes

- Updated dependencies [[`88b4a97`](https://github.com/mastra-ai/mastra/commit/88b4a970426f48731a153e46ed228d0301da32a1), [`33eaa29`](https://github.com/mastra-ai/mastra/commit/33eaa293e28aa8cd86ad68e1eaf44b4929be818d), [`c8a35ac`](https://github.com/mastra-ai/mastra/commit/c8a35ac6243eaef8ef1d9e589a7b75bf44904d8b)]:
  - @mastra/core@1.84.0-alpha.3
