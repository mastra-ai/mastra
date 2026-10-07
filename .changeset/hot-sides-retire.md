---
'mastracode': patch
'@mastra/core': patch
---

Fixed Ctrl+C discarding messages queued with Ctrl+F. Queued messages and slash commands now still run after you interrupt the current response (#25748).
