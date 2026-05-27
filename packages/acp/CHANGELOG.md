# @mastra/acp

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
