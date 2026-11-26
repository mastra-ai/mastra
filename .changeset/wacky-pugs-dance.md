---
'@mastra/lance': patch
---

Fixed LanceDB vector upsert failing when metadata contains dotted keys or null values. Keys with dots are now stored as underscored columns (matching how filters already resolve them) and null values no longer break Arrow/Lance schema inference, so upserts succeed and metadata round-trips exactly on read.
