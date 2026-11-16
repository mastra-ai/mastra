---
'@mastra/memory': patch
---

Fixed Observational Memory crashing when capped history rendering encounters a message text part without text. Incomplete text parts are skipped without changing stored history or adjacent valid content.
