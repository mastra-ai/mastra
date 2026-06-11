---
"@mastra/core": patch
---

fix(workspace): normalize file URI keys in LSP diagnostics map to fix Windows mismatch

On Windows, LSP servers (e.g. lua-language-server) emit VS Code-style URIs
like file:///c%3A/... while Node's pathToFileURL produces file:///C:/...
The Map key mismatch caused waitForDiagnostics to always return [] on Windows.

Fix: key the diagnostics map by normalized OS path via diagnosticsKey() which
strips leading slashes, lowercases the drive letter, and handles percent-encoded
colons — making store and lookup keys match regardless of which URI form the
server emits.

Fixes #17813
