---
'mastracode': patch
---

Fixed mastracode crashing on startup with ERR_MODULE_NOT_FOUND for vscode-jsonrpc/node. Node.js ESM requires explicit .js extensions on subpath imports.
