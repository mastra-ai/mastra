---
'@mastra/code-sdk': minor
---

Added a restricted server embedding API that requires host-owned models, instructions, storage, workspaces, project identity, and tool allowlists.

Import from `@mastra/code-sdk/restricted` to mount a controller without local configuration, credential, repository, plugin, MCP, workflow, goal, subagent, or binary discovery.

The allowlist bounds every mode and workspace tool. Session state can't turn on auto-approval (through `yolo` or `allow` permission rules the host didn't set), global instructions, plugins, or observational memory model selection, modes can't bring their own agent, and the model catalog doesn't expose the server's provider credentials.

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
