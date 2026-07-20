---
'@mastra/core': patch
---

Fixed agent schedules targeting stored agents being permanently deleted after a server restart. Schedules now resolve stored agents through the editor and remain available when resolution temporarily fails.
