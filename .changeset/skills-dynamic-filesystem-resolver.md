---
'@mastra/core': patch
---

Fix skill discovery ignoring a dynamic `filesystem` resolver on `Workspace`. When `filesystem` was a `({ requestContext }) => WorkspaceFilesystem` function and `skills` was set without an explicit `skillSource`, skills were silently read from the server's local disk via `LocalSkillSource` instead of the resolved filesystem. This could surface host-local skills to every tenant and never discover the tenant's own skills.

Skills are now resolved per request against the filesystem returned by the resolver, with discovery and search state cached per resolved filesystem and isolated between them. Static filesystems, explicit `skillSource`, and the no-filesystem `LocalSkillSource` fallback are unchanged.

```ts
const workspace = new Workspace({
  filesystem: ({ requestContext }) => getTenantFilesystem(requestContext.get('orgId')),
  skills: ['skills'],
});

// Now reads from the tenant's filesystem, not process.cwd()
const scoped = await workspace.skills!.getScoped!({ requestContext });
await scoped.list();
```
