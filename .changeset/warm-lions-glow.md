---
'@mastra/core': minor
---

Add LSP diagnostics to workspace edit tools

Edit tools (write_file, edit_file, ast_edit) now append diagnostics from language
servers after edits. Supports TypeScript, Python (pyright), Go (gopls), Rust
(rust-analyzer), and ESLint. Requires sandbox with process manager; gracefully
degrades when deps unavailable.
