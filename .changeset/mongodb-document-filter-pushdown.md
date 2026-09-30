---
'@mastra/mongodb': patch
---

Fixed `documentFilter` with operators like `$regex` failing on MongoDB Atlas vector queries. Filters that `$vectorSearch` can't evaluate now run as a pre-filter instead of being sent inside `$vectorSearch.filter`.
