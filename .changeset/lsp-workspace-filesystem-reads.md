---
'@mastra/core': patch
---

Fixed `lsp_inspect` for files that exist only in a remote sandbox. The tool now reads inspected files and definition previews through the workspace filesystem. When the workspace filesystem can't read the inspected file, the tool returns a `Could not read file` error instead of reading a host file at the same path, which on a remote sandbox is unrelated content. The host filesystem is used only when the workspace has no filesystem.
