---
'@mastra/lance': minor
---

Fixed metadata round-trip for keys containing underscores (e.g., resource_id, thread_id). New data is stored with a JSON column for lossless retrieval.

**Note for existing data**

Old data without the JSON column returns flat column names (e.g., `details_text` instead of `{ details: { text } }`). Re-insert data to get correct nested structure.

Fixes #12500
