---
'@mastra/core': patch
'mastracode': patch
---

Switch mastracode to use workspace tools for filesystem, grep, glob, edit, write, and command execution instead of built-in tool implementations

- Map sandbox `data-sandbox-stdout`/`data-sandbox-stderr` data chunks to `shell_output` harness events for TUI streaming
- Add TUI rendering for process management tools (`get_process_output`, `kill_process`)
- Fix TUI edit file diff rendering to support workspace tool arg names (`old_string`/`new_string`)
