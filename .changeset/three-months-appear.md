---
'@mastra/core': patch
---

Fixed workspace LSP support for TypeScript 7 projects. Code inspection (diagnostics, hover) now works in workspaces using TypeScript 7, including hoisted monorepo and pnpm installations. No configuration changes are needed — existing `lsp: true` setups keep working, and TypeScript 6 and earlier behavior is unchanged.

Fixes [#19601](https://github.com/mastra-ai/mastra/issues/19601)
