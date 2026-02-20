---
'@mastra/core': patch
---

Added per-file write locking to workspace tools (edit_file, write_file, ast_edit, delete). Concurrent tool calls targeting the same file are now serialized, preventing race conditions where parallel edits could silently overwrite each other.
