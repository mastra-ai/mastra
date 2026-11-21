---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/mysql': minor
'@mastra/mongodb': minor
---

Knowledge page stores can now remove a template page or an empty scope, and restore a removed scope.

- `removeTemplatePage` deletes a declared template page and records that it was removed, so reopening the store or re-materializing the scope does not bring it back. An ordinary page that later reuses the key does not undo this.
- `removeScope` removes a scope with no live pages or child scopes and drops its pins. Writes to a removed scope's address fail with `KnowledgeScopeRemovedError` instead of reviving it, and removed scopes are left out of scope lookups and listings.
- `restoreScope` brings a removed scope back with the same id, as long as its parent scope is live. Template pages removed before stay removed.

Removal and child creation are serialized, so a scope is never removed while a page is being created in it.
