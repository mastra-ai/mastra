---
'@mastra/server': patch
---

Fixed repeated workflow start errors to return HTTP 409 and forwarded the outer workflow identity to remote step workers.
