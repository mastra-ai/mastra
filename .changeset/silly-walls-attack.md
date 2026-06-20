---
'@mastra/core': minor
'mastracode': patch
---

Moved the tool-permission rule accessors off the Harness onto `session.permissions`. Reading and writing the persisted per-category / per-tool approval policies now lives on the session, next to the state it reads and writes.

**Before**

```typescript
const rules = harness.getPermissionRules();
harness.setPermissionForCategory({ category: 'execute', policy: 'ask' });
harness.setPermissionForTool({ toolName: 'dangerous_tool', policy: 'deny' });
```

**After**

```typescript
const rules = harness.session.permissions.getRules();
await harness.session.permissions.setForCategory({ category: 'execute', policy: 'ask' });
await harness.session.permissions.setForTool({ toolName: 'dangerous_tool', policy: 'deny' });
```

Removed `Harness.getPermissionRules`, `Harness.setPermissionForCategory`, and `Harness.setPermissionForTool`. The setters now return a promise that resolves once the change is persisted to session state, so callers that read the rules back can await the write. Tool-category resolution stays on the harness as `harness.getToolCategory()` since it reads harness config rather than session state.

`mastracode` is updated to consume the new API: the `/permissions` command reads and sets policies via `session.permissions`.
