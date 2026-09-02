---
'@mastra/pg': patch
---

Fixed PgVector failing with "Vector table does not exist" when no schemaName is configured and the connecting role has a same-named schema on its search_path. Catalog lookups used by listIndexes, describeIndex and the namespace migration now resolve through the effective search_path (like the table creation already did) instead of assuming the public schema. Without an explicit schemaName, listIndexes now reports vector tables from every schema on the search_path. Fixes #22545
