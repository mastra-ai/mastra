---
'@mastra/lance': patch
---

Fixed LanceDB vector upsert failing when metadata contains dotted keys or null values, and when a typed metadata column appears only in a later row of the batch than the first. Keys with dots are now stored as underscored columns (matching how filters already resolve them), null values no longer break Arrow/Lance schema inference, and the existing-table schema check considers the columns of every row in the batch rather than just the first, so upserts succeed and metadata round-trips exactly on read.
