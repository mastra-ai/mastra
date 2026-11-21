---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/mysql': minor
'@mastra/mongodb': minor
---

Knowledge can now remove a page declared in config, remove an empty scope, and restore a removed scope. These are host-only (`knowledge.removeTemplatePage`, `knowledge.removeScope`, `knowledge.restoreScope`); agent tools still can't remove declared pages.

```ts
const removed = await knowledge.removeScope({ scope: 'repo:acme:sandbox' });
// later, if needed
await knowledge.restoreScope({ id: removed!.id });
```

`removePage`, `removeTemplatePage` and `removeScope` take an optional `expected: { id, version }`: the page as you read it. The removal then fails with `KnowledgeConflictError`, removing nothing, if that page is gone, was replaced by another page at the same address, or changed since.

```ts
const removed = await knowledge.removeScope({
  scope: 'repo:acme:sandbox',
  expected: { id: seen.id, version: seen.version },
});
```

The matching store methods:

- `removeTemplatePage` deletes a declared template page and records that it was removed, so reopening the store or re-materializing the scope does not bring it back. An ordinary page that later reuses the key does not undo this.
- `removeScope` removes a scope with no live pages or child scopes and drops its pins. Writes to a removed scope's address fail with `KnowledgeScopeRemovedError` instead of reviving it, and removed scopes are left out of scope lookups and listings.
- `restoreScope` brings a removed scope back with the same id, as long as its parent scope is live. Template pages removed before stay removed.

Removed scopes no longer count toward their declaration, so once every scope of a type is removed its declaration can be dropped from config. A scope can only be restored while its address still matches the declaration it was created from.

Removal is serialized against creating, moving or merging pages into the same parent, so a scope or template page is never removed while a page lands under it.

On MongoDB these three operations need transactions (a replica set or sharded cluster). On a standalone server they refuse with an error and write nothing, instead of falling back to unprotected sequential writes.
