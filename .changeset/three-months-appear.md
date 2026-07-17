---
'@mastra/core': patch
---

Fixed LSP support for TypeScript 7 projects. TypeScript 7 removed `lib/tsserver.js` and ships a native Go-based language server (`tsc --lsp --stdio`) that speaks LSP directly. The built-in TypeScript server definition now detects which TypeScript version is installed and uses the appropriate server: the `typescript-language-server` wrapper for TS ≤6, or `tsc --lsp --stdio` for TS 7+ (only when the resolved `typescript` package is version 7 or later, so an unrelated `tsc` on PATH is never used). Hoisted/monorepo installs are supported by resolving the `tsc` binary next to wherever the `typescript` package resolves.

The LSP client also now supports pull diagnostics (`textDocument/diagnostic`), used automatically when a server advertises `diagnosticProvider` — this covers TypeScript 7's native server (which never pushes diagnostics) and newer ESLint language servers.

Fixes [#19601](https://github.com/mastra-ai/mastra/issues/19601)
