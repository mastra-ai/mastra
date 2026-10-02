---
'@mastra/code-sdk': patch
---

Fixed Unix socket path validation to prevent unsafe resource and thread IDs from escaping the socket directory.
