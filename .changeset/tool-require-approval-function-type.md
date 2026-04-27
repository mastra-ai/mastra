---
'@mastra/core': patch
---

Fixed the TypeScript type for `requireApproval` on tools so it accepts a function. The runtime already supported function values for conditional approval (added in #15346), but the type still required `boolean` and rejected functions, forcing an `as any` cast.

**Before**

```typescript
createTool({
  id: 'delete-file',
  inputSchema: z.object({ isDryRun: z.boolean() }),
  // Type error: function not assignable to boolean
  requireApproval: async ({ isDryRun }) => !isDryRun,
  execute: async (input) => {
    /* ... */
  },
});
```

**After**

```typescript
createTool({
  id: 'delete-file',
  inputSchema: z.object({ isDryRun: z.boolean() }),
  requireApproval: async ({ isDryRun }) => !isDryRun,
  execute: async (input) => {
    /* ... */
  },
});
```

The function receives the validated tool input and an optional second context argument with `requestContext` and `workspace`, matching the existing workspace tool config pattern.
