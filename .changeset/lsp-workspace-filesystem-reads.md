---
'@mastra/core': patch
---

Fixed `lsp_inspect` for files that exist only in a remote sandbox. The tool reads inspected files and definition previews through the workspace filesystem. It falls back to the host filesystem when needed. If neither filesystem can read the inspected file, the tool returns an error instead of inspecting an empty document.
