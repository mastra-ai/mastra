---
'@mastra/core': minor
'@mastra/server': minor
---

Added workspace registration and tool context support. Workspaces can now be registered with Mastra for O(1) lookup via `addWorkspace()`, `getWorkspaceById()`, and `listWorkspaces()`. Tools can access the workspace through `context.workspace` during execution, enabling filesystem and sandbox operations. Supports dynamic workspace configuration via agent config functions.

**Workspace Registration**

```typescript
const mastra = new Mastra({
  workspace: myWorkspace, // Auto-registered
});

// Or register manually
mastra.addWorkspace(workspace);
const ws = mastra.getWorkspaceById('my-workspace');
```

**Tool Workspace Access**

```typescript
const myTool = createTool({
  id: 'file-reader',
  execute: async ({ context }) => {
    const fs = context.workspace?.filesystem;
    const content = await fs?.readFile('config.json');
    return { content };
  },
});
```

**Dynamic Workspace Configuration**

```typescript
const agent = new Agent({
  workspace: ({ mastra, requestContext }) => {
    // Return workspace dynamically based on context
    return mastra.getWorkspaceById(requestContext?.get('workspaceId'));
  },
});
```
