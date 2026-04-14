---
'@mastra/pg': patch
---

Fixed vector operations failing when pgvector extension is installed in a custom schema. The search_path is now set before index creation and vector similarity queries, ensuring operator classes (e.g. vector_cosine_ops) and distance operators (e.g. <=>) resolve correctly regardless of where the extension is installed. Previously, only table creation set the search_path, causing CREATE INDEX and query operations to fail with unresolvable operator errors.
