---
'@mastra/core': patch
'mastracode': patch
---

Switched Mastra Code to workspace tools and enabled LSP by default

- Switched from built-in tool implementations to workspace tools for file operations, search, edit, write, and command execution
- Enabled LSP (language server) by default with automatic package runner detection and bundled binary resolution
- Added real-time stdout/stderr streaming in the TUI for workspace command execution
- Added TUI rendering for process management tools (view output, kill processes)
- Fixed edit diff preview in the TUI to work with workspace tool arg names (`old_string`/`new_string`)
