---
'@mastra/code-sdk': patch
---

Fixed Unix socket path handling so a thread ID can no longer place a socket outside its resource directory, whether or not cross-project agent discovery is enabled. Thread IDs that would reuse the lease or discovery socket names are rejected as well.
