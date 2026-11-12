---
'@mastra/connect': patch
---

Fixed the Excel delete workbook tool failing with a "resource locked" error after the agent edited the workbook. Excel can keep a workbook locked for up to 30 minutes after cell edits, which previously made deletes fail until the lock expired.
