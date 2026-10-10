---
'@mastra/code-sdk': minor
---

Added a restricted server embedding API that requires host-owned models, instructions, storage, workspaces, project identity, and tool allowlists.

Import from `@mastra/code-sdk/restricted` to mount a controller without local configuration, credential, repository, plugin, MCP, workflow, goal, subagent, or binary discovery.

```typescript
import { mountRestrictedAgentControllerOnMastra } from '@mastra/code-sdk/restricted';

const { controller } = await mountRestrictedAgentControllerOnMastra({
  project,
  model,
  instructions,
  modes,
  allowedTools,
  tools,
  workspace,
  storage,
  memory,
});
```
