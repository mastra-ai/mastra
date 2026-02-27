---
'@mastra/core': minor
---

Added `serverPaths`, `modulePaths`, and `allowNpxFallback` options to `LSPConfig` to support flexible language server binary resolution.

Previously, workspace LSP diagnostics only worked when language server binaries were installed in the project's `node_modules/.bin/`. There was no way to use globally installed binaries or point to a custom install.

**New `LSPConfig` fields:**

- `serverPaths`: Override the binary command for a specific server, bypassing the default `node_modules` lookup. Useful when the binary is installed globally or in a non-standard location.
- `modulePaths`: Additional directories to search when resolving Node.js modules (e.g. `typescript/lib/tsserver.js`). Each entry should be a directory whose `node_modules` contains the required packages.
- `allowNpxFallback`: Allow `npx` as a last-resort fallback when no binary is found. Off by default — `npx` can hang in pnpm monorepos.

```ts
const workspace = new Workspace({
  lsp: {
    // Point to a globally installed binary
    serverPaths: {
      typescript: '/usr/local/bin/typescript-language-server --stdio',
    },
    // Resolve typescript/lib/tsserver.js from a tool's own node_modules
    modulePaths: ['/path/to/my-tool'],
    // Allow npx as a last resort (off by default)
    allowNpxFallback: false,
  },
});
```

Also exported `buildServerDefs(config?)` for building config-aware server definitions, and `LSPConfig` / `LSPServerDef` types from `@mastra/core/workspace`.
