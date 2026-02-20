---
'@mastra/core': minor
---

Moved LSP diagnostics from `LocalFilesystem` to `Workspace`. LSP now uses `sandbox.processes` to spawn language servers, making it work with any sandbox backend (local, E2B, etc.) that has a process manager. Enable via `lsp: true` on `Workspace` instead of `LocalFilesystem`.

**Breaking change:** `lsp` option moved from `LocalFilesystem` to `Workspace`. `LSPManager` constructor now requires a `SandboxProcessManager` as its first argument. `LSPServerDef.spawn` replaced with `LSPServerDef.command` (returns a command string) and optional `LSPServerDef.initialization`.

**LSP Diagnostics example:**

```ts
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: '/my/project' }),
  sandbox: new LocalSandbox(),
  lsp: true, // enables LSP diagnostics
});
// Edit tools now return diagnostics automatically:
// "/src/app.ts: Replaced 1 occurrence of pattern
//
// LSP Diagnostics:
// Errors:
//   12:5 - Type 'string' is not assignable to type 'number'. [typescript]"
```
