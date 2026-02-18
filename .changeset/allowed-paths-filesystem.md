---
'@mastra/core': minor
---

Added `allowedPaths` option to `LocalFilesystem` for granting agents access to specific directories outside `basePath` without disabling containment.

```typescript
const workspace = new Workspace({
  filesystem: new LocalFilesystem({
    basePath: './workspace',
    allowedPaths: ['/home/user/.config', '/home/user/documents'],
  }),
});
```

Allowed paths can be updated at runtime using `setAllowedPaths()`:

```typescript
workspace.filesystem.setAllowedPaths(prev => [...prev, '/home/user/new-dir']);
```

This is the recommended approach for least-privilege access — agents can only reach the specific directories you allow, while containment stays enabled for everything else.
