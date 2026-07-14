# @mastra/code-sdk

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
