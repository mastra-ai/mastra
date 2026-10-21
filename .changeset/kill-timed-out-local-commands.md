---
'@mastra/core': patch
---

Fixed `LocalSandbox` commands that could hang past their timeout. When a command times out, it is asked to stop and then force-killed two seconds later if it is still running, including child processes that keep its output open. Previously a command that ignored the stop request kept the tool call waiting forever.
