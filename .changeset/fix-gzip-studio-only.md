---
'@mastra/deployer': patch
---

Fixed gzip compression being applied globally to all API routes, causing JSON responses to be unreadable by clients that don't auto-decompress. Compression is now scoped to studio static assets only.
