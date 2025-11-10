---
'@mastra/mssql': patch
---

Prevents double stringification for MSSQL jsonb columns by reusing incoming strings that already contain valid JSON while still stringifying other inputs as needed.
