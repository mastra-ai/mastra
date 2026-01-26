---
"@mastra/codemod": patch
---

Added `workflow-get-init-data` codemod that transforms `getInitData()` calls to `getInitData<any>()`.

This codemod helps migrate code after the `getInitData` return type changed from `any` to `unknown`. Adding the explicit `<any>` type parameter restores the previous behavior while maintaining type safety.

**Usage:**

```bash
npx @mastra/codemod@latest v1/workflow-get-init-data .
```

**Before:**

```typescript
createStep({
  execute: async ({ getInitData }) => {
    const initData = getInitData();
    if (initData.key === 'value') {}
  },
});
```

**After:**

```typescript
createStep({
  execute: async ({ getInitData }) => {
    const initData = getInitData<any>();
    if (initData.key === 'value') {}
  },
});
```
