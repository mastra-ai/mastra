# @mastra/cursor

## 0.2.1

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`339c57c`](https://github.com/mastra-ai/mastra/commit/339c57c5b2c6dbe75a125e138228e0556528976f), [`1dd4117`](https://github.com/mastra-ai/mastra/commit/1dd4117dcbd8e031ede9f0489436bfbc6f0315b8), [`2b11d1f`](https://github.com/mastra-ai/mastra/commit/2b11d1f6ac7024c5dd2b2dd12a48a956ac9d63bd), [`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d), [`b7dff0a`](https://github.com/mastra-ai/mastra/commit/b7dff0a3d1022eb6868f48dc40a2b1febd5c277f), [`02087e1`](https://github.com/mastra-ai/mastra/commit/02087e1fbc54aa07f3071f7a200df1bf5be601a8), [`49af8df`](https://github.com/mastra-ai/mastra/commit/49af8df589c4ff71a5015a4553b377b32704b691), [`30ce559`](https://github.com/mastra-ai/mastra/commit/30ce55902ecf819b8ab8697398dd68b108228063), [`c241b92`](https://github.com/mastra-ai/mastra/commit/c241b929dc8c8d6a7b7219c99ed13ac1f3124a77), [`7d6ff70`](https://github.com/mastra-ai/mastra/commit/7d6ff708727297a0526ca0e26e93eeb5bbaaa187), [`ab975d4`](https://github.com/mastra-ai/mastra/commit/ab975d4dd9488752f05bda7afa03166d207e3e2a), [`9d6aa1b`](https://github.com/mastra-ai/mastra/commit/9d6aa1bae407e2afa6a089abc2a6accbbcb287b8)]:
  - @mastra/core@1.44.0

## 0.2.1-alpha.0

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d)]:
  - @mastra/core@1.43.1-alpha.0

## 0.2.0

### Minor Changes

- Added structured output support for Claude and OpenAI SDK agents using their provider-native structured output APIs. Cursor SDK agent calls now fail clearly when structuredOutput is requested because the Cursor TypeScript SDK does not expose a schema-constrained output API. SDK agents now implement provider-native resume through Mastra's existing resumeGenerate/resumeStream methods by accepting provider-specific resumeData with a message payload. Cursor SDK agent options now use the same clear source split as OpenAI: pass either a pre-created agent or SDK options for wrapper-created agents. ([#17580](https://github.com/mastra-ai/mastra/pull/17580))

  Example:

  ```ts
  await claudeAgent.resumeGenerate({
    message: 'Continue the task.',
    sessionId: 'claude-session-id',
  });

  await openAIAgent.resumeStream({
    message: 'Continue the task.',
    previousResponseId: 'resp_123',
  });

  const result = await openAIAgent.generate('Return the answer as JSON.', {
    structuredOutput: {
      schema: z.object({ answer: z.string() }),
    },
  });
  // result.object has shape { answer: string }
  ```

  Claude and OpenAI SDK agents support `structuredOutput` through their native SDK APIs. `CursorSDKAgent` throws a clear error when `structuredOutput` is requested because the Cursor TypeScript SDK does not expose schema-constrained output.

### Patch Changes

- Updated dependencies [[`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`053735a`](https://github.com/mastra-ai/mastra/commit/053735a75c2c18e23ce34d9468007efa4a45f4c4), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`e9be4e7`](https://github.com/mastra-ai/mastra/commit/e9be4e747ec3d8b65548bff92f9377db06105376), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`d53cfc2`](https://github.com/mastra-ai/mastra/commit/d53cfc2c7f8d78343a4aa84ec4e129ba25f3325e), [`65799d4`](https://github.com/mastra-ai/mastra/commit/65799d4d549e5ebb9c848fbe3f51ac090f64becf), [`c268c89`](https://github.com/mastra-ai/mastra/commit/c268c89f4c63a93ee474d3cffdf3ea60bf00d4f2), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`014e00f`](https://github.com/mastra-ai/mastra/commit/014e00f2b3a597a016b72f9901c6ab27d491f822), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`0c72f03`](https://github.com/mastra-ai/mastra/commit/0c72f032abb13254df5a7856d64be2f207b8006d), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`3b45ea9`](https://github.com/mastra-ai/mastra/commit/3b45ea95015557a6cb9d70dc5252af54ab1b78ac), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`f084be1`](https://github.com/mastra-ai/mastra/commit/f084be1fcbe33ad7480913e44d6130c421c0976f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`f2ab060`](https://github.com/mastra-ai/mastra/commit/f2ab060162bea81505fda553e2cee29c1979fd04), [`5d302c8`](https://github.com/mastra-ai/mastra/commit/5d302c8eda1a6ac74eab5e442c4f64db6cc97a06), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`a952852`](https://github.com/mastra-ai/mastra/commit/a952852c971a21fb646cd907c75fcf4443cdc963), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552)]:
  - @mastra/core@1.42.0

## 0.2.0-alpha.0

### Minor Changes

- Added structured output support for Claude and OpenAI SDK agents using their provider-native structured output APIs. Cursor SDK agent calls now fail clearly when structuredOutput is requested because the Cursor TypeScript SDK does not expose a schema-constrained output API. SDK agents now implement provider-native resume through Mastra's existing resumeGenerate/resumeStream methods by accepting provider-specific resumeData with a message payload. Cursor SDK agent options now use the same clear source split as OpenAI: pass either a pre-created agent or SDK options for wrapper-created agents. ([#17580](https://github.com/mastra-ai/mastra/pull/17580))

  Example:

  ```ts
  await claudeAgent.resumeGenerate({
    message: 'Continue the task.',
    sessionId: 'claude-session-id',
  });

  await openAIAgent.resumeStream({
    message: 'Continue the task.',
    previousResponseId: 'resp_123',
  });

  const result = await openAIAgent.generate('Return the answer as JSON.', {
    structuredOutput: {
      schema: z.object({ answer: z.string() }),
    },
  });
  // result.object has shape { answer: string }
  ```

  Claude and OpenAI SDK agents support `structuredOutput` through their native SDK APIs. `CursorSDKAgent` throws a clear error when `structuredOutput` is requested because the Cursor TypeScript SDK does not expose schema-constrained output.

### Patch Changes

- Updated dependencies [[`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552)]:
  - @mastra/core@1.42.0-alpha.4

## 0.1.0

### Minor Changes

- Added `@mastra/cursor`, a package for running Cursor SDK agents through Mastra. ([#16906](https://github.com/mastra-ai/mastra/pull/16906))

  Create a Cursor SDK agent, register it with Mastra, and call `generate()` or `stream()` with Mastra-compatible outputs. Runs keep Cursor SDK usage and observability data available to Mastra.

  ```ts
  import { CursorSDKAgent } from '@mastra/cursor';

  export const cursorAgent = new CursorSDKAgent({
    id: 'cursor-sdk-agent',
    description: 'Use Cursor Agent SDK through Mastra.',
    sdkOptions: {
      apiKey: process.env.CURSOR_API_KEY,
      model: { id: process.env.CURSOR_MODEL_ID! },
      local: {
        cwd: process.cwd(),
      },
    },
  });
  ```

### Patch Changes

- Updated dependencies [[`fa63872`](https://github.com/mastra-ai/mastra/commit/fa6387280954e6b667bec5714b55ba082bc627ff), [`d779de3`](https://github.com/mastra-ai/mastra/commit/d779de3cd9d2e7ed8110547190e2f15e786a0e41), [`1750c97`](https://github.com/mastra-ai/mastra/commit/1750c975d6179fbf6db2813b15229d4f8f23fc55), [`9283971`](https://github.com/mastra-ai/mastra/commit/928397157009b4aef4d5fdf3a0a273cb371beb55), [`f07b646`](https://github.com/mastra-ai/mastra/commit/f07b64604ab7d25391179790b7fd4823df9e2dff), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`40f9297`](https://github.com/mastra-ai/mastra/commit/40f9297003b921c62373d3e8d3a4bda76c9f6de3), [`19a8658`](https://github.com/mastra-ai/mastra/commit/19a86589c788ef48bb6c1b0612cc82a201857379), [`850af77`](https://github.com/mastra-ai/mastra/commit/850af7779cb87c350804488734544a5b1843de25), [`0f0d1ba`](https://github.com/mastra-ai/mastra/commit/0f0d1ba67bfcb2204e571401662f1eceefc03357), [`a18775a`](https://github.com/mastra-ai/mastra/commit/a18775a693172546ee2378d39b67d4e32895b251), [`1baf2d1`](https://github.com/mastra-ai/mastra/commit/1baf2d152c6881338ff8f114633d5316fe13dd15), [`8c31bcd`](https://github.com/mastra-ai/mastra/commit/8c31bcdb00e597880d5939b1b7d7566fbe5dacae), [`0e32507`](https://github.com/mastra-ai/mastra/commit/0e32507962cdfa5569b7bda5bc6fb3dd34e40b03), [`95b14cd`](https://github.com/mastra-ai/mastra/commit/95b14cdd820e86d97ac05fe568424c513a252e31), [`07c3de7`](https://github.com/mastra-ai/mastra/commit/07c3de7f7bc418beccaea3b5e6b7f7cdda79d492), [`0bf2d93`](https://github.com/mastra-ai/mastra/commit/0bf2d932d20e2936f2d9abb8c0a86e24fbc97ec6), [`7b0d34c`](https://github.com/mastra-ai/mastra/commit/7b0d34cfe4a2fce22ac86ae17404685ff67a2ddb), [`a659a77`](https://github.com/mastra-ai/mastra/commit/a659a779bdebe3a52a518c56d2260592d0240fe0), [`aa36be2`](https://github.com/mastra-ai/mastra/commit/aa36be23aa513b7dc53cb8ca16b7fab8f20e43ad), [`3332be9`](https://github.com/mastra-ai/mastra/commit/3332be9701ecd77aba840959d9a1d1ce7aef02d3), [`212c635`](https://github.com/mastra-ai/mastra/commit/212c635203e61d036ab41db8ff86c3893dc795b3), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`9aa5a73`](https://github.com/mastra-ai/mastra/commit/9aa5a73e7e110f6e9365eec69364a33d5f03bb56), [`f73c789`](https://github.com/mastra-ai/mastra/commit/f73c789e8ef21561580395d2c410119cab5848c8), [`8bd16da`](https://github.com/mastra-ai/mastra/commit/8bd16da73a4cb874d739373643dbd6a6e7f88684), [`c8630f8`](https://github.com/mastra-ai/mastra/commit/c8630f80d4f40cb5d22e60ab162b618b1907167a), [`94dfef6`](https://github.com/mastra-ai/mastra/commit/94dfef6e2bf19a88467ea3940afcbce88a433f0f), [`47f71dc`](https://github.com/mastra-ai/mastra/commit/47f71dc6fbcbd12d71e21a979e676e20a02bd77d), [`50ceae2`](https://github.com/mastra-ai/mastra/commit/50ceae270878e2f8fb2b2c6c2faab09df0007c8a), [`a122f79`](https://github.com/mastra-ai/mastra/commit/a122f79427ae225ec79c7b2ed46278da48d04b17), [`8cdde58`](https://github.com/mastra-ai/mastra/commit/8cdde5875bbba6702d9df226f2b20232b8d75d6c), [`3a081c1`](https://github.com/mastra-ai/mastra/commit/3a081c1255c5ae8c99f6dad91cc612934ef6f2bd), [`49f8abc`](https://github.com/mastra-ai/mastra/commit/49f8abce8258e4f2f87bd326acfbdb641264a47c), [`847ff1e`](https://github.com/mastra-ai/mastra/commit/847ff1e0d94368d94b2e173e4e0908e115568ef3), [`0c1ed1d`](https://github.com/mastra-ai/mastra/commit/0c1ed1d00c7d87b5ac99ca95896211a2fa9189fa), [`259d409`](https://github.com/mastra-ai/mastra/commit/259d409a514174299dbde1ff5e1121209b3ba850), [`9e16c68`](https://github.com/mastra-ai/mastra/commit/9e16c6818b6485ccb43df28aba6f3a2219d28662), [`cefca33`](https://github.com/mastra-ai/mastra/commit/cefca33ae666e69810c935fedf95a929c173d1d7), [`d00e8c5`](https://github.com/mastra-ai/mastra/commit/d00e8c50daebe5bce5bf2f48bde39c86fc3d2fe4), [`36fa7e2`](https://github.com/mastra-ai/mastra/commit/36fa7e24d14e58a1eb46147097b32f583e5b8775), [`87e9774`](https://github.com/mastra-ai/mastra/commit/87e97741c1e493cd6d62f478eb810b49bda4d57c), [`65a72e7`](https://github.com/mastra-ai/mastra/commit/65a72e70c25eedea8ff985a6624b96be2850236b), [`fe9eacd`](https://github.com/mastra-ai/mastra/commit/fe9eacd9545a0a9d64aad31c9fa90294a425289e), [`4c02027`](https://github.com/mastra-ai/mastra/commit/4c020277235eaa6b1dc957c90ad0639eef213992), [`0f77241`](https://github.com/mastra-ai/mastra/commit/0f7724108806703799a8ba80ad0f09414afd5066), [`849efb9`](https://github.com/mastra-ai/mastra/commit/849efb9fca6dc976589c1f90a303fea618769109), [`92ff509`](https://github.com/mastra-ai/mastra/commit/92ff5098ef8a990438ca038077021a5f7541ec1d), [`3fce5e7`](https://github.com/mastra-ai/mastra/commit/3fce5e70d011d289043e75003ef3336ed4aa43c3), [`a763592`](https://github.com/mastra-ai/mastra/commit/a763592c3db46963ef1011cfe16fe372816e775e), [`db79c86`](https://github.com/mastra-ai/mastra/commit/db79c86c60723d57e02f9636ca2611bd4515f194), [`6855012`](https://github.com/mastra-ai/mastra/commit/685501247cc4717506f3e89beed03509d63a5370), [`80c7737`](https://github.com/mastra-ai/mastra/commit/80c7737e32d7917b5f356957d67c169d01744fd3), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`3f1cf47`](https://github.com/mastra-ai/mastra/commit/3f1cf476f74c1e4cc2df908837e05853a5347e31)]:
  - @mastra/core@1.38.0

## 0.1.0-alpha.1

### Minor Changes

- Added `@mastra/cursor`, a package for running Cursor SDK agents through Mastra. ([#16906](https://github.com/mastra-ai/mastra/pull/16906))

  Create a Cursor SDK agent, register it with Mastra, and call `generate()` or `stream()` with Mastra-compatible outputs. Runs keep Cursor SDK usage and observability data available to Mastra.

  ```ts
  import { CursorSDKAgent } from '@mastra/cursor';

  export const cursorAgent = new CursorSDKAgent({
    id: 'cursor-sdk-agent',
    description: 'Use Cursor Agent SDK through Mastra.',
    sdkOptions: {
      apiKey: process.env.CURSOR_API_KEY,
      model: { id: process.env.CURSOR_MODEL_ID! },
      local: {
        cwd: process.cwd(),
      },
    },
  });
  ```

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.38.0-alpha.7

## 0.1.0-alpha.0

Initial release.
