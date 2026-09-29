---
'@mastra/mysql': patch
---

Fixed MySQL skills storage dropping a skill's inline file tree (`files`) on save, so skill files now persist and load correctly.
