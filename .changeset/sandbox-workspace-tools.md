---
'@mastra/core': minor
'@mastra/playground-ui': patch
---

Added workspace tools for background process management and improved sandbox execution UI.

- `execute_command` now supports `background: true` to spawn long-running processes and return a PID
- New `get_process_output` tool to check output/status of background processes (supports `wait` to block until exit)
- New `kill_process` tool to terminate background processes
- Output truncation helpers with configurable tail lines
- Sandbox execution badge UI: terminal-style output display with streaming, exit codes, killed status, and workspace metadata
