---
'@mastra/core': minor
---

Added `name` property to `WorkspaceToolConfig` for remapping workspace tool names. Tools can now be exposed under custom names to the LLM while keeping the original constant as the config key.

```typescript
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './project' }),
  tools: {
    mastra_workspace_read_file: { name: 'view' },
    mastra_workspace_grep: { name: 'search_content' },
    mastra_workspace_edit_file: { name: 'string_replace_lsp' },
  },
});
```

Also removed hardcoded tool-name cross-references from edit-file and ast-edit tool descriptions, since tools can be renamed or disabled.
