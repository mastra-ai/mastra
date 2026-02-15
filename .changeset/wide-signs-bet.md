---
'@mastra/core': patch
'@mastra/codemod': patch
---

Workspace tools are now disabled by default. Previously, configuring a workspace on an agent would auto-inject all workspace tools. Now you must explicitly opt in.

To keep the old behavior, either add `tools: { enabled: true }` to your Workspace config, or import tools directly:

```typescript
import { readFileTool, writeFileTool } from '@mastra/core/workspace';

const agent = new Agent({
  tools: { readFileTool, writeFileTool },
  workspace: new Workspace({ filesystem }),
});
```

To auto-fix existing code, run: `npx @mastra/codemod workspace-tools-enabled ./src`

`WorkspaceToolsConfig` and `WorkspaceToolConfig` types are deprecated. Import workspace tools directly from `@mastra/core/workspace` instead.
