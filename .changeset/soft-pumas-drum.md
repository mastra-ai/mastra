---
'@mastra/core': minor
---

Added `get(pid, { release: false })` to the sandbox process manager. It reads a process without dismissing it once it has exited, so a UI can show a finished command's output and an agent can still read it afterwards. The default is unchanged.
