---
'@mastra/core': minor
---

Added LSP diagnostics to Workspace. LSP uses `sandbox.processes` to spawn language servers, making it work with any sandbox backend (local, E2B, etc.) that has a process manager.

The project root for LSP servers is resolved per-file by walking up from the file's directory to find project markers (tsconfig.json, package.json, go.mod, etc.). This supports monorepos and multi-language projects. A default root can be set explicitly via `lsp.root`, otherwise it's auto-resolved from `process.cwd()`.

```ts
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: '/my/project' }),
  sandbox: new LocalSandbox(),
  lsp: true, // or { root: '/my/project' } to set explicitly
});
// Edit tools now return diagnostics automatically:
// "/src/app.ts: Replaced 1 occurrence of pattern
//
// LSP Diagnostics:
// Errors:
//   12:5 - Type 'string' is not assignable to type 'number'. [typescript]"
```
