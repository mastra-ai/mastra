---
'@mastra/mssql': patch
---

Fixes MSSQL store test configuration and pagination issues:

- Adds missing id parameter to test configuration and updates documentation
- Implements page validation to handle negative page numbers
- Fixes sorting and pagination bugs in message listing (improves ORDER BY with seq_id secondary sort and corrects hasMore calculation)
