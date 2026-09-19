---
'@mastra/pg': minor
---

Add bounded PostgreSQL history scans with stable ID continuation so deleting earlier rows does not skip retained threads or messages. Cursors preserve query scope across restarts; legacy messages retain their stored IDs and content.
