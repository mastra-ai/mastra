---
'@mastra/pg': minor
---

Added transactional Knowledge scope reconciliation for PostgreSQL storage, and paginated scope-node reads filtered in the database by subtree, address, or scope ID. Content nodes may share a name with a scope; only sibling scopes must have unique names.
