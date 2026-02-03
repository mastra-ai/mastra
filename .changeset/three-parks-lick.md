---
'@mastra/core': minor
---

Added workspace registration and tool context support.

**Workspace Registration** - Register workspaces with Mastra for O(1) lookup via `addWorkspace()`, `getWorkspaceById()`, and `listWorkspaces()`. Agent workspaces are auto-registered when adding agents.

```typescript
const mastra = new Mastra({
  workspace: myWorkspace, // Auto-registered
});

// Or register manually
mastra.addWorkspace(workspace);
const ws = mastra.getWorkspaceById('my-workspace');
```

**Tool Workspace Access** - Tools can access the workspace through `context.workspace` during execution, enabling filesystem and sandbox operations.

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

**Dynamic Workspace Configuration** - Workspace can be configured dynamically via agent config functions, following the same pattern as dynamic model configuration. Dynamically created workspaces are auto-registered with Mastra, making them available via `listWorkspaces()` and visible in server/studio.

```typescript
const agent = new Agent({
  workspace: ({ mastra, requestContext }) => {
    // Thread-scoped workspaces - each new workspace is auto-registered
    const threadId = requestContext?.get('threadId');
    return new Workspace({
      id: `workspace-${threadId}`,
      filesystem: new LocalFilesystem({ basePath: `/data/${threadId}` }),
    });
  },
});

// Later, all dynamically created workspaces are accessible
const allWorkspaces = mastra.listWorkspaces(); // includes thread-scoped ones
```
