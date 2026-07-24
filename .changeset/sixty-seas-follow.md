---
'@mastra/code-sdk': patch
---

Fixed database corruption in concurrent Mastra Code sessions by using safer journaling for the shared local database.
