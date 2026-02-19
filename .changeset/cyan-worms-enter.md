---
'@mastra/core': minor
---

Added AST edit tool (`workspace_ast_edit`) for intelligent code transformations — rename functions/variables, add/remove/merge imports, and pattern-based find-and-replace using AST analysis. Requires `@ast-grep/napi` as an optional peer dependency.

**Example:**

```ts
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: '/my/project' }),
});
const tools = createWorkspaceTools(workspace);

// Rename a function across the file
await tools.workspace_ast_edit.execute({
  path: '/src/utils.ts',
  transform: 'rename-function',
  targetName: 'oldName',
  newName: 'newName',
});

// Add an import
await tools.workspace_ast_edit.execute({
  path: '/src/app.ts',
  transform: 'add-import',
  importSpec: { module: 'react', names: ['useState', 'useEffect'] },
});
```
