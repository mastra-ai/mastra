---
'@mastra/core': patch
---

Bound the output that the `execute_command` tool retains while a foreground command streams. Previously the tool kept its own unbounded copy of stdout and stderr, which was only read on the error path but could exhaust memory or kill the process with `RangeError: Invalid string length` on very large command output.
