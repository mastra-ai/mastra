---
'@mastra/core': minor
---

Added workspace registration and tool context support.

**Why** - Makes it easier to manage multiple workspaces at runtime and lets tools read/write files in the intended workspace.

**Workspace Registration** - Added a workspace registry so you can list and fetch workspaces by id with `addWorkspace()`, `getWorkspaceById()`, and `listWorkspaces()`. Agent workspaces are auto-registered when adding agents.

**Before**
```typescript
const mastra = new Mastra({ workspace: myWorkspace });
// No way to look up workspaces by id or list all workspaces
```

**After**
```typescript
const mastra = new Mastra({ workspace: myWorkspace });

// Look up by id
const ws = mastra.getWorkspaceById('my-workspace');

// List all registered workspaces
const allWorkspaces = mastra.listWorkspaces();

// Register additional workspaces
mastra.addWorkspace(anotherWorkspace);
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

**Dynamic Workspace Configuration** - Workspace can be configured dynamically via agent config functions. Dynamically created workspaces are auto-registered with Mastra, making them available via `listWorkspaces()`.

```typescript
const agent = new Agent({
  workspace: ({ mastra, requestContext }) => {
    // Return workspace dynamically based on context
    const workspaceId = requestContext?.get('workspaceId') || 'default';
    return mastra.getWorkspaceById(workspaceId);
  },
});
```
