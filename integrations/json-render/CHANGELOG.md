# @mastra/json-render

## 0.2.0

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

- Stopped publishing JavaScript source maps (`.js.map` and `.cjs.map` files) and their `//# sourceMappingURL=` comments. They made up more than half of the installed size of some packages and pointed at `src/*.ts` files that are not included in the package. ([#31176](https://github.com/mastra-ai/mastra/pull/31176))

- Stopped publishing TypeScript declaration map files (`.d.ts.map`). They pointed at source files that are not included in the package, so they could not be used after install. Installs are smaller (about 1,050 fewer files and 2 MB less for `@mastra/core`), and go to definition and type checking work exactly as before. ([#31173](https://github.com/mastra-ai/mastra/pull/31173))

- Updated dependencies [[`8bc3a19`](https://github.com/mastra-ai/mastra/commit/8bc3a19a73e6e683a29d8c8cf8ab1f0bf4343a26), [`d250e06`](https://github.com/mastra-ai/mastra/commit/d250e06d7c63b02aa0e5b7c61e1e54e07dcad13b), [`9315b28`](https://github.com/mastra-ai/mastra/commit/9315b2895a617947513be1f96d8964037b505f38), [`004f350`](https://github.com/mastra-ai/mastra/commit/004f35031e7419a16263f8641d43c9cd19275ae0), [`90d9424`](https://github.com/mastra-ai/mastra/commit/90d9424563cf6bf8204b2633da54039dc1d73c3a), [`81ed17c`](https://github.com/mastra-ai/mastra/commit/81ed17ce35e20d03485ca427df44bddab9d9c0cd), [`0b89469`](https://github.com/mastra-ai/mastra/commit/0b89469a5e4061b352b0408d2339966e8e38ffb8), [`432e9be`](https://github.com/mastra-ai/mastra/commit/432e9bee6a30750e092c972a28e2f40027c6d7c5), [`16c6902`](https://github.com/mastra-ai/mastra/commit/16c6902f8b971c4950fea55e13a8038022bde8bb), [`40e2880`](https://github.com/mastra-ai/mastra/commit/40e288024e8f7a1cda436ff37ae94d52cc597b13), [`fac783c`](https://github.com/mastra-ai/mastra/commit/fac783cfa8b3109b21acc970ea2015f826523993), [`a331da2`](https://github.com/mastra-ai/mastra/commit/a331da2b2354aa6fedc01651c39545fb7db82ebc), [`f030844`](https://github.com/mastra-ai/mastra/commit/f03084426faf5d65c78ab391b74c3773ac173b0c), [`7c0c1cd`](https://github.com/mastra-ai/mastra/commit/7c0c1cdc9ed1211b3705554bf205a30ef05b0796), [`8b945c5`](https://github.com/mastra-ai/mastra/commit/8b945c5d5f308d49684e89fd8262ecf37e2d198e), [`9e4a5e8`](https://github.com/mastra-ai/mastra/commit/9e4a5e8bbf3f76f84fa7c1fad8acbab6692c704c), [`8bbaab6`](https://github.com/mastra-ai/mastra/commit/8bbaab64784fac9426f5b2bd0e35f1bd6ae4640a), [`21a82af`](https://github.com/mastra-ai/mastra/commit/21a82af6e1c08daaa3c2700c98ac95a96e66399e), [`19f6a57`](https://github.com/mastra-ai/mastra/commit/19f6a57b3adbacdf104d99197ddf5d4491fe7e0c), [`70947c4`](https://github.com/mastra-ai/mastra/commit/70947c4a6eaf470823a62fdd603e44a47ed000c7), [`1219d8a`](https://github.com/mastra-ai/mastra/commit/1219d8a6b41b8f9fcf6e4bcfac42df71b3650963), [`5da059e`](https://github.com/mastra-ai/mastra/commit/5da059edbb8b9ec2ede0f3e9ca2227f87c650841), [`f35fac5`](https://github.com/mastra-ai/mastra/commit/f35fac5b216214a6fc6407558f94fc2f4cbcc610), [`1ecb70b`](https://github.com/mastra-ai/mastra/commit/1ecb70b19d147189deab144108cd2fcc97b1dec8), [`0458fdc`](https://github.com/mastra-ai/mastra/commit/0458fdc0c19abc0359746247cb55b71dd4afaf6e), [`5972780`](https://github.com/mastra-ai/mastra/commit/59727806f9f8dbbaecb31c38875106f4b93aec12), [`d5546d6`](https://github.com/mastra-ai/mastra/commit/d5546d686498ddb3981f4e1e05c322eba9777e07), [`6b862fb`](https://github.com/mastra-ai/mastra/commit/6b862fbb9513200c8607c35c1d2894ac75d3b6c8), [`62a09d4`](https://github.com/mastra-ai/mastra/commit/62a09d45eb44fcccd544c904b709e161f2289c54), [`40e2880`](https://github.com/mastra-ai/mastra/commit/40e288024e8f7a1cda436ff37ae94d52cc597b13), [`a2ae8a2`](https://github.com/mastra-ai/mastra/commit/a2ae8a26a4928724afc7fccbe4a26e8c75c157b2), [`3b11b67`](https://github.com/mastra-ai/mastra/commit/3b11b677ee2c1755c7a6ab2691cb3ac7269cde84), [`16428c7`](https://github.com/mastra-ai/mastra/commit/16428c7ad01ac22cd76a09a6721566d31202b41b), [`400664e`](https://github.com/mastra-ai/mastra/commit/400664ef60612a6667e7e1017c147fd71310b422), [`b758985`](https://github.com/mastra-ai/mastra/commit/b7589855bc3463bf57e6a79f0945d1bfe3135a0d), [`79a30b6`](https://github.com/mastra-ai/mastra/commit/79a30b6d5c758bf46f0633059eded42bffbeb443), [`7fd3ce8`](https://github.com/mastra-ai/mastra/commit/7fd3ce86639e6e02a2c284c5715eed5db1a04f64), [`7fd3ce8`](https://github.com/mastra-ai/mastra/commit/7fd3ce86639e6e02a2c284c5715eed5db1a04f64), [`7fd3ce8`](https://github.com/mastra-ai/mastra/commit/7fd3ce86639e6e02a2c284c5715eed5db1a04f64), [`3baa66d`](https://github.com/mastra-ai/mastra/commit/3baa66dfc785c222bb727a6da6012a0f28480b4a), [`7fd3ce8`](https://github.com/mastra-ai/mastra/commit/7fd3ce86639e6e02a2c284c5715eed5db1a04f64), [`7fd3ce8`](https://github.com/mastra-ai/mastra/commit/7fd3ce86639e6e02a2c284c5715eed5db1a04f64), [`fa2ea6d`](https://github.com/mastra-ai/mastra/commit/fa2ea6dfb5c13a5f9b4bdc99f332959f7b0f4209), [`4b5c347`](https://github.com/mastra-ai/mastra/commit/4b5c347734329ff434d7cdcb6408c23dfe046540), [`b8af9e3`](https://github.com/mastra-ai/mastra/commit/b8af9e313eb446fadb24454dc18fa19aa08a8cea), [`7388601`](https://github.com/mastra-ai/mastra/commit/73886018497772a47154f67ce512081d8f3e9818), [`bff16da`](https://github.com/mastra-ai/mastra/commit/bff16dab4cea3236a9ef50b53286065d5a8d31cf), [`0280c14`](https://github.com/mastra-ai/mastra/commit/0280c141dae50809cfc7f6bd7e27d1f65432121c), [`c28f67d`](https://github.com/mastra-ai/mastra/commit/c28f67d81eede65d220ff742f2f56804603c6674), [`389f3cd`](https://github.com/mastra-ai/mastra/commit/389f3cdf5c8117a674c0ca14363a4f19f4abb769), [`537db2e`](https://github.com/mastra-ai/mastra/commit/537db2eb061006191283d0473a85472b87d201b3), [`827b54a`](https://github.com/mastra-ai/mastra/commit/827b54a6b566665bd283b88920436f59718e054a), [`ad5059e`](https://github.com/mastra-ai/mastra/commit/ad5059e90c201279628a799f1434a8fe35140b55), [`45b8470`](https://github.com/mastra-ai/mastra/commit/45b847050897411092b1c665cdbcbb59e2bec485), [`6795e22`](https://github.com/mastra-ai/mastra/commit/6795e22a64852f6ae67d3d518e18308a27ca8572), [`dc2df74`](https://github.com/mastra-ai/mastra/commit/dc2df747b7274f8b96e132c3b121ec2707d5a895), [`fcf9c18`](https://github.com/mastra-ai/mastra/commit/fcf9c1897ad3eac3ceb66e43b97e60812712866a), [`464299b`](https://github.com/mastra-ai/mastra/commit/464299bcacd7c94203af3345bcbcd1614b207e38), [`0f098fe`](https://github.com/mastra-ai/mastra/commit/0f098fe2425bc467ff9a800c41433efe90c44e58), [`8a0acd5`](https://github.com/mastra-ai/mastra/commit/8a0acd5ab9367a48d100b9c53eeb62362e6ddb72), [`389851e`](https://github.com/mastra-ai/mastra/commit/389851ef0380c222b6223148b8c070a6919b7a8e), [`9c4810b`](https://github.com/mastra-ai/mastra/commit/9c4810b48652bee44663452f136df5e9d9247d40), [`45320c3`](https://github.com/mastra-ai/mastra/commit/45320c334035c969dcef98a91de6ad2a6610c8c0), [`40e2880`](https://github.com/mastra-ai/mastra/commit/40e288024e8f7a1cda436ff37ae94d52cc597b13), [`fe0b7e0`](https://github.com/mastra-ai/mastra/commit/fe0b7e081ca4edee13d330da5b2749086f105154), [`f2c23af`](https://github.com/mastra-ai/mastra/commit/f2c23af7f751a3e195d7bd52bd0377edb5f9072b), [`2f04296`](https://github.com/mastra-ai/mastra/commit/2f04296f9b815fde8395a32ddbabd214fdf2f914), [`692ca19`](https://github.com/mastra-ai/mastra/commit/692ca19a7943d24a8607de8414176a690362f3c8), [`bc2dcc7`](https://github.com/mastra-ai/mastra/commit/bc2dcc78b75b4467d95afaf2b7369c54880d207a), [`50e318b`](https://github.com/mastra-ai/mastra/commit/50e318bd77cc72ac0a148c900bb48b8f0b759b75), [`16c44e8`](https://github.com/mastra-ai/mastra/commit/16c44e81c52768f4a82b6a400971361d84f1deb7), [`b008c95`](https://github.com/mastra-ai/mastra/commit/b008c95fa93c5a73ae08c4f86e99d7bd55bf3e78), [`d1f0a92`](https://github.com/mastra-ai/mastra/commit/d1f0a92ca41e1b725ed296abeb540908d09b5c64), [`4c71c2e`](https://github.com/mastra-ai/mastra/commit/4c71c2e776563852ef2301d674a1b8c70f511039), [`3fe2318`](https://github.com/mastra-ai/mastra/commit/3fe2318cba624a0e48cff0ec5c8503bfa0a4804b), [`8fab5e2`](https://github.com/mastra-ai/mastra/commit/8fab5e2fda43beca4be00e43d4f231cdd87fd7fd), [`679bf03`](https://github.com/mastra-ai/mastra/commit/679bf037e8db50357c183b8655114d3238d92018), [`6507fdc`](https://github.com/mastra-ai/mastra/commit/6507fdc6343363bc33eef8e30e83f50c50fc90ab), [`3fe2318`](https://github.com/mastra-ai/mastra/commit/3fe2318cba624a0e48cff0ec5c8503bfa0a4804b), [`f77bcb1`](https://github.com/mastra-ai/mastra/commit/f77bcb1a5bcdfebda3df4b4adec8e6ac5f5f4e18), [`89fb271`](https://github.com/mastra-ai/mastra/commit/89fb27175fd7036b8600241da8a6d288a7f2bae4), [`4e0b782`](https://github.com/mastra-ai/mastra/commit/4e0b7820880774ed87c151d6575ba13820035773), [`a6a5b78`](https://github.com/mastra-ai/mastra/commit/a6a5b7808581c6e7dc086a165580b23138d5e441), [`4aeb6ce`](https://github.com/mastra-ai/mastra/commit/4aeb6ce414105e45b1c36d174258f9165738ecef), [`8a0acd5`](https://github.com/mastra-ai/mastra/commit/8a0acd5ab9367a48d100b9c53eeb62362e6ddb72), [`0d8280d`](https://github.com/mastra-ai/mastra/commit/0d8280ddd778487b89bd2504ced24e3586e7711f), [`e3ed577`](https://github.com/mastra-ai/mastra/commit/e3ed57715f9668d9da55e7636ebefa10b141ebc4), [`55a2249`](https://github.com/mastra-ai/mastra/commit/55a2249be2f5505e3022856d477628e6ca2fd9a9)]:
  - @mastra/core@1.86.0

## 0.2.0-alpha.1

### Patch Changes

- Stopped publishing JavaScript source maps (`.js.map` and `.cjs.map` files) and their `//# sourceMappingURL=` comments. They made up more than half of the installed size of some packages and pointed at `src/*.ts` files that are not included in the package. ([#31176](https://github.com/mastra-ai/mastra/pull/31176))

- Stopped publishing TypeScript declaration map files (`.d.ts.map`). They pointed at source files that are not included in the package, so they could not be used after install. Installs are smaller (about 1,050 fewer files and 2 MB less for `@mastra/core`), and go to definition and type checking work exactly as before. ([#31173](https://github.com/mastra-ai/mastra/pull/31173))

- Updated dependencies [[`16c6902`](https://github.com/mastra-ai/mastra/commit/16c6902f8b971c4950fea55e13a8038022bde8bb), [`8bbaab6`](https://github.com/mastra-ai/mastra/commit/8bbaab64784fac9426f5b2bd0e35f1bd6ae4640a), [`5972780`](https://github.com/mastra-ai/mastra/commit/59727806f9f8dbbaecb31c38875106f4b93aec12), [`d5546d6`](https://github.com/mastra-ai/mastra/commit/d5546d686498ddb3981f4e1e05c322eba9777e07), [`3b11b67`](https://github.com/mastra-ai/mastra/commit/3b11b677ee2c1755c7a6ab2691cb3ac7269cde84), [`16428c7`](https://github.com/mastra-ai/mastra/commit/16428c7ad01ac22cd76a09a6721566d31202b41b), [`7388601`](https://github.com/mastra-ai/mastra/commit/73886018497772a47154f67ce512081d8f3e9818), [`45320c3`](https://github.com/mastra-ai/mastra/commit/45320c334035c969dcef98a91de6ad2a6610c8c0), [`3fe2318`](https://github.com/mastra-ai/mastra/commit/3fe2318cba624a0e48cff0ec5c8503bfa0a4804b), [`8fab5e2`](https://github.com/mastra-ai/mastra/commit/8fab5e2fda43beca4be00e43d4f231cdd87fd7fd), [`3fe2318`](https://github.com/mastra-ai/mastra/commit/3fe2318cba624a0e48cff0ec5c8503bfa0a4804b), [`89fb271`](https://github.com/mastra-ai/mastra/commit/89fb27175fd7036b8600241da8a6d288a7f2bae4), [`4aeb6ce`](https://github.com/mastra-ai/mastra/commit/4aeb6ce414105e45b1c36d174258f9165738ecef), [`e3ed577`](https://github.com/mastra-ai/mastra/commit/e3ed57715f9668d9da55e7636ebefa10b141ebc4), [`55a2249`](https://github.com/mastra-ai/mastra/commit/55a2249be2f5505e3022856d477628e6ca2fd9a9)]:
  - @mastra/core@1.86.0-alpha.6

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
