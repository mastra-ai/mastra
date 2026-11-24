---
'@mastra/mongodb': patch
---

Fixed `createSearchIndex` failing with "indexes had duplicate ids" when two processes refreshed the same full-text search index at the same time. Calling `createSearchIndex` again with the mapping the index already has no longer rewrites the index; a different `fields` mapping still updates it in place.
