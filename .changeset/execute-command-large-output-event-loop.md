---
'@mastra/core': patch
---

Fixed `execute_command` (and other workspace tools that cap output by tokens) freezing the process for seconds when a command prints a lot of output. The token limit now estimates the full output with a cheap word count, cuts it down to the part that can be kept, and runs the exact token count only on that part, so a 30 MB output no longer blocks every other request, session and timer. Small outputs are truncated exactly as before.
