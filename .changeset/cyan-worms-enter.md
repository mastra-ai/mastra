---
'@mastra/core': minor
---

Added AST edit tool (`workspace_ast_edit`) for intelligent code transformations using AST analysis. Supports renaming identifiers, adding/removing/merging imports, and pattern-based find-and-replace with metavariable substitution. Automatically available when `@ast-grep/napi` is installed in the project.

**Example:**

```ts
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: '/my/project' }),
});
const tools = createWorkspaceTools(workspace);

// Rename all occurrences of an identifier
await tools['mastra_workspace_ast_edit'].execute({
  path: '/src/utils.ts',
  transform: 'rename',
  targetName: 'oldName',
  newName: 'newName',
});

// Add an import (merges into existing imports from the same module)
await tools['mastra_workspace_ast_edit'].execute({
  path: '/src/app.ts',
  transform: 'add-import',
  importSpec: { module: 'react', names: ['useState', 'useEffect'] },
});

// Pattern-based replacement with metavariables
await tools['mastra_workspace_ast_edit'].execute({
  path: '/src/app.ts',
  pattern: 'console.log($ARG)',
  replacement: 'logger.debug($ARG)',
});
```
