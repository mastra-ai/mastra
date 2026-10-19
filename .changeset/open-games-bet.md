---
'@mastra/core': patch
---

Fixed `get_process_output` with `wait: true` hanging after a background command had exited. When the command left a child running that still held its output open (`cmd &`, or a child of `timeout`), the wait never returned. It now returns once the command exits and its output has had a moment to drain, and says when a process the command started is still running. That process can still be stopped with `kill_process`, and is still stopped with the sandbox. A foreground command that starts a process in the background (`cmd &`) now returns once its shell exits rather than at its timeout, and the process it left behind is stopped when it returns. Use `background: true` for processes that should keep running.
