---
'@mastra/core': patch
---

Fixed skill discovery for `Workspace` instances that use a dynamic `filesystem` resolver.

When `skills` is configured without `skillSource`, discovery now uses the filesystem resolved for the request. It no longer reads skills from the server's local disk, so host-local skills cannot appear for other tenants and each tenant's own skills are found.

Skill discovery and search state are isolated per resolved filesystem, with a bounded cache so per-request filesystems do not grow the search index. Unscoped `workspace.search()` no longer returns request-scoped skill documents (from dynamic `skills` resolvers or resolver-backed filesystems) and still returns up to `topK` regular documents. Static filesystems, explicit `skillSource`, and the no-filesystem fallback are unchanged.

```ts
const workspace = new Workspace({
  filesystem: ({ requestContext }) => getTenantFilesystem(requestContext.get('orgId')),
  skills: ['skills'],
});

// Now reads from the tenant's filesystem, not process.cwd()
const scoped = await workspace.skills!.getScoped!({ requestContext });
await scoped.list();
```
