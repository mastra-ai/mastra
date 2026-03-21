---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added storage support for dataset targeting and experiment status fields.

- Added `targetType` (text) and `targetIds` (jsonb) columns to datasets table for entity association
- Added `tags` (jsonb) column to datasets table for tag vocabulary
- Added `status` column to experiment results for review workflow tracking
- Added migration logic to add new columns to existing tables
