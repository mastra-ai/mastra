---
'@mastra/libsql': minor
---

Added LibSQL storage implementations for Datasets and Experiments. `LibSQLStore` now automatically includes `DatasetsLibSQL` and `ExperimentsLibSQL` domains with full SCD-2 item versioning support.

**Requires `@mastra/core` >= 1.4.0**
