---
'@mastra/pg': patch
---

Improved thread listing speed when filtering by metadata, such as the agent controller's `tags` filter. Databases whose thread metadata column is still text are unchanged.

Fixed index creation for descending columns that use an operator class.
