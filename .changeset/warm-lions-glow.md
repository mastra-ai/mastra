---
'@mastra/core': minor
---

Add LSP diagnostics to workspace edit tools

Language Server Protocol (LSP) diagnostics now appear after edits made with write_file, edit_file, and ast_edit.
Seeing type and lint errors immediately helps catch issues before the next tool call.
Edits still work without diagnostics when language servers are not installed.

Supports TypeScript, Python (Pyright), Go (gopls), Rust (rust-analyzer), and ESLint.

**Example**

Before:

```ts
const workspace = new Workspace({ sandbox, filesystem });
```

After:

```ts
const workspace = new Workspace({ sandbox, filesystem, lsp: true });
```
