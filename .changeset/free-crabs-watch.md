---
'@mastra/pg': patch
---

Fixed PostgreSQL workflow creation so a delayed create request cannot overwrite a running or completed run, and enabled atomic outer workflow start claims.
