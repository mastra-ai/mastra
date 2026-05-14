# @mastra/acp

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
