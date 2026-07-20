# @mastra/acp

## 0.4.0-alpha.0

### Minor Changes

- Added a `createClient` option to `createACPTool()` and `AcpAgent` for customizing the ACP client, and fixed a crash when the ACP agent command fails to start. ([#19559](https://github.com/mastra-ai/mastra/pull/19559))

  **Custom ACP client (`createClient`)**

  Some ACP agents call custom extension methods (`extMethod` / `extNotification`) on the client. The built-in client rejected these with a "Method not found" error and could not be replaced, so those agents were unusable without reimplementing the whole connection. The new `createClient` option receives the default client and returns the client used for the connection:

  ```ts
  import { createACPTool } from '@mastra/acp';

  const tool = createACPTool({
    id: 'grok',
    description: 'Dispatch tasks to Grok',
    command: 'grok',
    createClient: defaultClient =>
      Object.assign(defaultClient, {
        extMethod: async (method, params) => ({}),
        extNotification: async (method, params) => {},
      }),
  });
  ```

  The `Client` type is now re-exported from `@mastra/acp` for fully custom implementations.

  **Spawn failure handling**

  If the configured `command` could not be started (for example the executable does not exist), the child process 'error' event was unhandled and crashed the host process. Tool execution now rejects with the spawn error instead.

  Fixes #19109

### Patch Changes

- Updated dependencies [[`1426af2`](https://github.com/mastra-ai/mastra/commit/1426af24975879c000d13ac75673f630fcc970c1), [`975295d`](https://github.com/mastra-ai/mastra/commit/975295d418552f0d46a59edfef4c3ee555f9930a), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`ef03c0c`](https://github.com/mastra-ai/mastra/commit/ef03c0cfc62367a458e4cc56462e2148b35681c5), [`4fb4d88`](https://github.com/mastra-ai/mastra/commit/4fb4d881bc107acee13890ad4d78661016c510ed), [`4eba27a`](https://github.com/mastra-ai/mastra/commit/4eba27adcf60f991df0e62f94b3e75b4e67f3b4b), [`c701be3`](https://github.com/mastra-ai/mastra/commit/c701be32d7d9aa94a66da8c6cc38dcac6856f464)]:
  - @mastra/core@1.52.0-alpha.3

## 0.3.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0

## 0.3.0-alpha.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0-alpha.0

## 0.2.2

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`339c57c`](https://github.com/mastra-ai/mastra/commit/339c57c5b2c6dbe75a125e138228e0556528976f), [`1dd4117`](https://github.com/mastra-ai/mastra/commit/1dd4117dcbd8e031ede9f0489436bfbc6f0315b8), [`2b11d1f`](https://github.com/mastra-ai/mastra/commit/2b11d1f6ac7024c5dd2b2dd12a48a956ac9d63bd), [`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d), [`b7dff0a`](https://github.com/mastra-ai/mastra/commit/b7dff0a3d1022eb6868f48dc40a2b1febd5c277f), [`02087e1`](https://github.com/mastra-ai/mastra/commit/02087e1fbc54aa07f3071f7a200df1bf5be601a8), [`49af8df`](https://github.com/mastra-ai/mastra/commit/49af8df589c4ff71a5015a4553b377b32704b691), [`30ce559`](https://github.com/mastra-ai/mastra/commit/30ce55902ecf819b8ab8697398dd68b108228063), [`c241b92`](https://github.com/mastra-ai/mastra/commit/c241b929dc8c8d6a7b7219c99ed13ac1f3124a77), [`7d6ff70`](https://github.com/mastra-ai/mastra/commit/7d6ff708727297a0526ca0e26e93eeb5bbaaa187), [`ab975d4`](https://github.com/mastra-ai/mastra/commit/ab975d4dd9488752f05bda7afa03166d207e3e2a), [`9d6aa1b`](https://github.com/mastra-ai/mastra/commit/9d6aa1bae407e2afa6a089abc2a6accbbcb287b8)]:
  - @mastra/core@1.44.0

## 0.2.2-alpha.0

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d)]:
  - @mastra/core@1.43.1-alpha.0

## 0.2.1

### Patch Changes

- Fixed ACP tools to keep their default session alive across executions. ([#17516](https://github.com/mastra-ai/mastra/pull/17516))

- Updated dependencies [[`f82cc72`](https://github.com/mastra-ai/mastra/commit/f82cc72edca0ce636fe18abaf2598d89a0c6bcca), [`fcf6027`](https://github.com/mastra-ai/mastra/commit/fcf602747f6771731dda268ff3493b836f9f0ee9)]:
  - @mastra/core@1.41.0

## 0.2.1-alpha.0

### Patch Changes

- Fixed ACP tools to keep their default session alive across executions. ([#17516](https://github.com/mastra-ai/mastra/pull/17516))

- Updated dependencies [[`f82cc72`](https://github.com/mastra-ai/mastra/commit/f82cc72edca0ce636fe18abaf2598d89a0c6bcca), [`fcf6027`](https://github.com/mastra-ai/mastra/commit/fcf602747f6771731dda268ff3493b836f9f0ee9)]:
  - @mastra/core@1.41.0-alpha.0

## 0.2.0

### Minor Changes

- Added programmatic model selection for ACP agents using the `model` option. ([#17010](https://github.com/mastra-ai/mastra/pull/17010))

  You can now set the model directly when creating `AcpAgent` or `createACPTool`, instead of relying on environment variables.

  ```ts
  const codeAgent = new AcpAgent({
    id: 'code-agent',
    description: 'ACP-compatible coding agent',
    command: 'claude',
    args: ['--acp'],
    model: 'claude-sonnet-4-20250514',
  });
  ```

  Discover available models with `getAvailableModels()` and change the model at runtime with `setModel()`. Invalid model IDs throw a descriptive error listing valid options.

### Patch Changes

- Removed zod as a required peer dependency. Internal schemas now use plain JSON Schema objects instead of zod runtime. ([#16726](https://github.com/mastra-ai/mastra/pull/16726))

- Updated dependencies [[`cfa2e3a`](https://github.com/mastra-ai/mastra/commit/cfa2e3a5292322f48bb28b4d257d631da7f9d3cc), [`0cbece9`](https://github.com/mastra-ai/mastra/commit/0cbece9d832cb134a74cdbf3682d390a058215a4), [`2f5f58a`](https://github.com/mastra-ai/mastra/commit/2f5f58a9a8bb13bcdc6789db221eef7c9bf1ff02), [`7dfe1bc`](https://github.com/mastra-ai/mastra/commit/7dfe1bcfe71d261a6fd6bbf29b1dec49d78fb98f), [`ac442a4`](https://github.com/mastra-ai/mastra/commit/ac442a42fda0354ac2bcea772bf6691cb3e9dbb3), [`b7286f4`](https://github.com/mastra-ai/mastra/commit/b7286f4308267f5fd70e6bfee10dba9472640906), [`6096445`](https://github.com/mastra-ai/mastra/commit/60964459733f0ab384584d95e19c36607ffdf7b0), [`d72dc4b`](https://github.com/mastra-ai/mastra/commit/d72dc4b12d832546c05c20255fa96fe4eb515900), [`a481027`](https://github.com/mastra-ai/mastra/commit/a481027b549ba1018414990c8f045eaee7b9f413), [`1e5c067`](https://github.com/mastra-ai/mastra/commit/1e5c067d2e20a781af670578180d1ee249806d41), [`168fa09`](https://github.com/mastra-ai/mastra/commit/168fa09d6b39114cb8c13bd06f1dccb9bc81c6cd), [`df1947a`](https://github.com/mastra-ai/mastra/commit/df1947affa40f742067542251fac7ca759492ef4), [`ee59b74`](https://github.com/mastra-ai/mastra/commit/ee59b743ce73ad11784b4d9c6fbba8568edee1c8), [`a97b1a0`](https://github.com/mastra-ai/mastra/commit/a97b1a0abaed83946c3519d1e0f680d0815b8a67), [`008baaf`](https://github.com/mastra-ai/mastra/commit/008baafd8d851f831407045aebead5a2e3342eff), [`801baa0`](https://github.com/mastra-ai/mastra/commit/801baa07cccdbaec1d00942a92bdc831111744a2), [`8116436`](https://github.com/mastra-ai/mastra/commit/81164363eb225d774e41ff27da6a5ea611406688), [`c35b962`](https://github.com/mastra-ai/mastra/commit/c35b9625c7e854fcfdeee226a3338a750d0ff211), [`c27c4b9`](https://github.com/mastra-ai/mastra/commit/c27c4b9f137df5414fca4e45896aceccff6b0ed5), [`08b3b59`](https://github.com/mastra-ai/mastra/commit/08b3b590dd960dee6c9a6e39272f8927d803db6e), [`b3c3b18`](https://github.com/mastra-ai/mastra/commit/b3c3b189121489a3a51a8fd8204b569be9a89fe5), [`4084113`](https://github.com/mastra-ai/mastra/commit/408411370fc48a822e8b616b3b63f9409774e0e9), [`70cb714`](https://github.com/mastra-ai/mastra/commit/70cb7149c8f16f478e15b58498254a53181750a4), [`91cf0e0`](https://github.com/mastra-ai/mastra/commit/91cf0e027e511b871481a8576b56b7af83b15afd), [`7f9da22`](https://github.com/mastra-ai/mastra/commit/7f9da22efd5aa595e138a31de55a5f0f2f28b33d)]:
  - @mastra/core@1.37.0

## 0.2.0-alpha.1

### Patch Changes

- Removed zod as a required peer dependency. Internal schemas now use plain JSON Schema objects instead of zod runtime. ([#16726](https://github.com/mastra-ai/mastra/pull/16726))

- Updated dependencies [[`c35b962`](https://github.com/mastra-ai/mastra/commit/c35b9625c7e854fcfdeee226a3338a750d0ff211), [`4084113`](https://github.com/mastra-ai/mastra/commit/408411370fc48a822e8b616b3b63f9409774e0e9)]:
  - @mastra/core@1.37.0-alpha.8

## 0.2.0-alpha.0

### Minor Changes

- Added programmatic model selection for ACP agents using the `model` option. ([#17010](https://github.com/mastra-ai/mastra/pull/17010))

  You can now set the model directly when creating `AcpAgent` or `createACPTool`, instead of relying on environment variables.

  ```ts
  const codeAgent = new AcpAgent({
    id: 'code-agent',
    description: 'ACP-compatible coding agent',
    command: 'claude',
    args: ['--acp'],
    model: 'claude-sonnet-4-20250514',
  });
  ```

  Discover available models with `getAvailableModels()` and change the model at runtime with `setModel()`. Invalid model IDs throw a descriptive error listing valid options.

## 0.1.0

### Minor Changes

- You can now run ACP-compatible coding agents as Mastra tools or lightweight subagents. ACP agents support incremental response streaming and can be used anywhere Mastra accepts a `SubAgent`, including supervisor delegation and workflow steps. ([#16423](https://github.com/mastra-ai/mastra/pull/16423))

  ```ts
  import { createACPTool, AcpAgent } from '@mastra/acp';

  export const codingTool = createACPTool({
    id: 'coding-agent',
    command: 'my-acp-agent',
  });

  export const codingAgent = new AcpAgent({
    id: 'coding-agent',
    command: 'my-acp-agent',
  });
  ```

  You can also wire an `AcpAgent` into a supervisor or workflow as a `SubAgent`-compatible implementation:

  ```ts
  import { Agent } from '@mastra/core/agent';

  export const supervisor = new Agent({
    name: 'supervisor',
    instructions: 'Delegate coding tasks to the ACP agent.',
    model,
    agents: {
      codingAgent,
    },
  });
  ```

  Workflows and the Inngest workflow adapter now recognize `SubAgent`-compatible implementations when creating agent-backed workflow steps.

### Patch Changes

- Updated dependencies [[`20787de`](https://github.com/mastra-ai/mastra/commit/20787de5965234a1af28fe35f49437c537dbfa0d), [`784ad98`](https://github.com/mastra-ai/mastra/commit/784ad989549de91dc5d33ab8ef36caa6f7dcd34e), [`fceae1f`](https://github.com/mastra-ai/mastra/commit/fceae1f5f5db4722cb078a663c6eb4bd22944123), [`090a647`](https://github.com/mastra-ai/mastra/commit/090a647ba5a66d36f203f9f49457e03a1ff4e6fb), [`bf02acb`](https://github.com/mastra-ai/mastra/commit/bf02acbb8a6110f638ac844e89f1ebf04cb7fe74), [`090a647`](https://github.com/mastra-ai/mastra/commit/090a647ba5a66d36f203f9f49457e03a1ff4e6fb), [`bdb4cbf`](https://github.com/mastra-ai/mastra/commit/bdb4cbf8ba4b685d7481f28bb9dc3de6c79c9ed2), [`0fd3fbe`](https://github.com/mastra-ai/mastra/commit/0fd3fbe40fb63657aedd72f6e7b38c8e8ee6940d), [`f84447d`](https://github.com/mastra-ai/mastra/commit/f84447d6c80f3471836a9b300d246b331fb47e0d), [`a1a5b3e`](https://github.com/mastra-ai/mastra/commit/a1a5b3e42ab2ca5161ea21db59ebf28442680fa7), [`af84f57`](https://github.com/mastra-ai/mastra/commit/af84f571ed762e92e8e61c5f9a72363520914274), [`8b3c6f9`](https://github.com/mastra-ai/mastra/commit/8b3c6f90f7879833ba7d1bc70937e1d8f69d0804), [`fed0475`](https://github.com/mastra-ai/mastra/commit/fed0475ccfea31e4fc251469ac05640d0742c1f0), [`0d53730`](https://github.com/mastra-ai/mastra/commit/0d53730c1ed87ef80c87caa5701c4170ea8028e6), [`522f44d`](https://github.com/mastra-ai/mastra/commit/522f44d947214bfc06cff50599bae1ef3494880d)]:
  - @mastra/core@1.34.0

## 0.1.0-alpha.0

### Minor Changes

- You can now run ACP-compatible coding agents as Mastra tools or lightweight subagents. ACP agents support incremental response streaming and can be used anywhere Mastra accepts a `SubAgent`, including supervisor delegation and workflow steps. ([#16423](https://github.com/mastra-ai/mastra/pull/16423))

  ```ts
  import { createACPTool, AcpAgent } from '@mastra/acp';

  export const codingTool = createACPTool({
    id: 'coding-agent',
    command: 'my-acp-agent',
  });

  export const codingAgent = new AcpAgent({
    id: 'coding-agent',
    command: 'my-acp-agent',
  });
  ```

  You can also wire an `AcpAgent` into a supervisor or workflow as a `SubAgent`-compatible implementation:

  ```ts
  import { Agent } from '@mastra/core/agent';

  export const supervisor = new Agent({
    name: 'supervisor',
    instructions: 'Delegate coding tasks to the ACP agent.',
    model,
    agents: {
      codingAgent,
    },
  });
  ```

  Workflows and the Inngest workflow adapter now recognize `SubAgent`-compatible implementations when creating agent-backed workflow steps.

### Patch Changes

- Updated dependencies [[`20787de`](https://github.com/mastra-ai/mastra/commit/20787de5965234a1af28fe35f49437c537dbfa0d), [`784ad98`](https://github.com/mastra-ai/mastra/commit/784ad989549de91dc5d33ab8ef36caa6f7dcd34e), [`0d53730`](https://github.com/mastra-ai/mastra/commit/0d53730c1ed87ef80c87caa5701c4170ea8028e6)]:
  - @mastra/core@1.34.0-alpha.0
