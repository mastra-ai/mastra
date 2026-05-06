---
'@mastra/core': patch
---

Added Tool Gate policy checks to dynamic tool search and loading. Dynamic search results now hide denied tools, load_tool will not load denied tools, and previously loaded dynamic tools are removed when the current policy no longer allows them.
