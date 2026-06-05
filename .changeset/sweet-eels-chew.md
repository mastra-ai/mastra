---
'@mastra/core': minor
---

Added a workspace tool wrapper for applications that need to wrap built-in workspace tools before they are exposed to agents.

**Example**

```ts
const workspace = new Workspace({
  tools: {
    toolWrapper: (tool, { toolName, workspaceToolName }) => ({
      ...(tool as object),
      execute: async (input, context) => {
        console.log(`Running ${toolName} from ${workspaceToolName}`);
        return (tool as any).execute(input, context);
      },
    }),
  },
});
```
