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

Removal is serialized against creating, moving or merging pages into the same parent, so a scope or template page is never removed while a page lands under it.

On MongoDB these three operations need transactions (a replica set or sharded cluster). On a standalone server they refuse with an error and write nothing, instead of falling back to unprotected sequential writes.
