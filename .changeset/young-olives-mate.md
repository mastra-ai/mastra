---
'mastracode': minor
---

Workspace LSP diagnostics are now enabled by default in mastracode. Users can configure language server binary paths in `~/.mastracode/settings.json` or `.mastracode/settings.json`.

Previously, `edit_file` did not run LSP diagnostics in mastracode sessions. Now it does automatically — type errors, unused variables, and other diagnostics are returned after each file edit, without requiring `typescript-language-server` to be installed in the user's project.

To configure binary paths (e.g. if using a global install):

```json
// ~/.mastracode/settings.json
{
  "lsp": {
    "serverPaths": {
      "typescript": "/usr/local/bin/typescript-language-server --stdio"
    },
    "modulePaths": ["/path/to/custom/node_modules"],
    "allowNpxFallback": false
  }
}
```
