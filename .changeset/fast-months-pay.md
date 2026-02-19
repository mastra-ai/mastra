---
'@mastra/core': minor
---

Added LSP diagnostics provider that automatically returns type errors, warnings, and lint issues after workspace edit operations (`edit_file`, `write_file`, `ast_edit`). Requires `vscode-jsonrpc` and `vscode-languageserver-protocol` as optional peer dependencies. Enable via `lsp: true` on `LocalFilesystem`.

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
