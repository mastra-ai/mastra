---
"@mastra/core": patch
---

Fixed LSP diagnostics always returning empty arrays on Windows when using `lsp: true` in Workspace.

Previously, `waitForDiagnostics` returned `[]` after the full timeout on Windows even when the language server published non-empty diagnostics. This affected any LSP server emitting VS Code-style URIs (e.g. lua-language-server). Now diagnostics are correctly returned regardless of how the language server encodes the file URI.

Fixes #17813
