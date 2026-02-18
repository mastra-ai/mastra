---
'@mastra/core': minor
---

Added AST edit tool (`workspace_ast_edit`) for intelligent code transformations — rename functions/variables, add/remove/merge imports, and pattern-based find-and-replace using AST analysis. Requires `@ast-grep/napi` as an optional peer dependency.

Added LSP diagnostics provider that automatically returns type errors, warnings, and lint issues after workspace edit operations (`edit_file`, `write_file`, `ast_edit`). Requires `vscode-jsonrpc` and `vscode-languageserver-protocol` as optional peer dependencies. Enable via `lsp: true` on `LocalFilesystem`.

**AST Edit example:**

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

**LSP Diagnostics example:**

```ts
const workspace = new Workspace({
  filesystem: new LocalFilesystem({
    basePath: '/my/project',
    lsp: true, // enables LSP diagnostics
  }),
});
// Edit tools now return diagnostics automatically:
// "/src/app.ts: Replaced 1 occurrence of pattern
//
// LSP Diagnostics:
// Errors:
//   12:5 - Type 'string' is not assignable to type 'number'. [typescript]"
```
