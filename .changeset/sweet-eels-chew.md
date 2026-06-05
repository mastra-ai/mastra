---
'@mastra/core': minor
---

Added agent and workspace tool hooks for applications that need to run logic before and after tool calls execute.

**Example**

```ts
const agent = new Agent({
  name: 'Support Agent',
  instructions: 'Help users.',
  model,
  hooks: {
    beforeToolCall: ({ toolName, input }) => {
      console.log(`Running ${toolName}`, input);
    },
    afterToolCall: ({ toolName, output, error }) => {
      console.log(`Finished ${toolName}`, { output, error });
    },
  },
});

const workspace = new Workspace({
  tools: {
    hooks: {
      beforeToolCall: ({ toolName, workspaceToolName, input }) => {
        console.log(`Running ${toolName} from ${workspaceToolName}`, input);
      },
    },
  },
});
```
