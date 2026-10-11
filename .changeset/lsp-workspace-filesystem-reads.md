---
'@mastra/core': patch
---

Fixed `lsp_inspect` in remote sandboxes. The tool now reads the inspected file and definition previews through the workspace filesystem (falling back to the host filesystem), so files that exist only in a remote sandbox are no longer sent to the language server as empty documents. When a file can't be read at all, `lsp_inspect` returns an error instead of inspecting an empty document.
