---
'@mastra/core': patch
---

Added `outputTokensEstimate` to shell tool exit data. Workspace tools (execute_command, get_process_output, kill_process) now emit a tiktoken-based token count in the `data-sandbox-exit` chunk, and a new `shell_exit` harness event surfaces this to consumers.
