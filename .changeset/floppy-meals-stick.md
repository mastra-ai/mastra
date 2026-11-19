---
'@mastra/core': patch
---

**Fixed** `execute_command`, `read_file`, `grep` and `list_files` blocking the event loop for seconds when a command returned megabytes of output. Truncation now bounds its token counting to the output budget instead of counting the whole result, so a 20 MB result is trimmed to the same head and tail in milliseconds instead of stalling the server. Fixes #30951
