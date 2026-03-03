---
'mastracode': minor
---

Added `resolveModel` to the return value of `createMastraCode`, allowing consumers to use the fully-authenticated model resolver instead of having to reimplement provider logic locally.

```typescript
const { harness, resolveModel } = await createMastraCode({ cwd: projectPath });
const model = resolveModel('anthropic/claude-sonnet-4-20250514');
```
