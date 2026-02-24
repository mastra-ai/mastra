---
'@mastra/core': minor
'mastracode': patch
---

Added tail pipe extraction to execute_command tool — strips `| tail -N` from commands before execution so output streams in real time, then applies tail to the final result. Added `sandboxToModelOutput` to sandbox tools (execute_command, get_process_output, kill_process) to strip ANSI escape codes from tool results sent to the model while preserving colors in the stream. Added `setToolsConfig()` method to Workspace for dynamically updating per-tool configuration at runtime.
