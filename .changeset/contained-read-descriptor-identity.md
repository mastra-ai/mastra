---
'@mastra/core': patch
---

Reject contained local filesystem reads and directory listings when a symlink swap is detected outside configured roots; preserve metadata access to unreadable files.
