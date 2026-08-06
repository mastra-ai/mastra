---
'@mastra/pg': patch
---

Fixed PgVector equality filters for top-level metadata fields to emit `metadata->>'field'` matching B-tree `metadataIndexes`, preventing full table sequential scans on filtered vector queries.
