---
'@mastra/acp': minor
'@mastra/core': minor
'@mastra/inngest': patch
---

You can now run ACP-compatible coding agents as Mastra tools or lightweight subagents. ACP agents support incremental response streaming and can be used anywhere Mastra accepts a `SubAgent`, including supervisor delegation and workflow steps.

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
