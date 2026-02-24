---
'@mastra/core': minor
---

Added `Workspace.setToolsConfig()` method for dynamically updating per-tool configuration at runtime without recreating the workspace instance. Passing `undefined` re-enables all tools.

```ts
const workspace = new Workspace({ filesystem, sandbox });

// Disable write tools (e.g., in plan/read-only mode)
workspace.setToolsConfig({
  mastra_workspace_write_file: { enabled: false },
  mastra_workspace_edit_file: { enabled: false },
});

// Re-enable all tools
workspace.setToolsConfig(undefined);
```
