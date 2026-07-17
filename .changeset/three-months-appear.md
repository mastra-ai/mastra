---
'@mastra/core': patch
---

Fixed workspace LSP support for TypeScript 7 projects. TypeScript 7 removed `tsserver.js`, which broke code inspection (diagnostics, hover) in workspaces using it. The built-in TypeScript server now detects the installed TypeScript version and starts the right language server automatically, and the LSP client supports pull diagnostics for servers that require them (TypeScript 7's native server and newer ESLint language servers). No configuration changes are needed — existing `lsp: true` setups keep working, and TypeScript ≤6 behavior is unchanged.

Fixes [#19601](https://github.com/mastra-ai/mastra/issues/19601)
