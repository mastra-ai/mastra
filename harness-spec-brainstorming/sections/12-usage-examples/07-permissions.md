### 12.7 Permissions

```ts
// Grant a tool for this session only (until close).
await session.permissions.grantTool({ toolName: 'workspace_execute_command' });

// Revoke a previous grant.
await session.permissions.revokeTool({ toolName: 'workspace_execute_command' });

// Set a category-level policy.
await session.permissions.setPolicy({
  category: 'destructive',
  policy: 'ask',
});

// Inspect what's currently granted.
const grants = session.permissions.getGrants();
```
