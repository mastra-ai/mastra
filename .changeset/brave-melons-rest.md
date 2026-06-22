---
'@mastra/core': minor
'mastracode': patch
---

Removed the deprecated `Harness.getState()` and `Harness.setState()` compatibility wrappers, along with the unused private `updateState`. Harness state has lived on the session for a while; these were thin proxies marked `@deprecated`.

**Before**

```typescript
const state = harness.getState();
await harness.setState({ count: 1 });
```

**After**

```typescript
const state = harness.session.state.get();
await harness.session.state.set({ count: 1 });
```

This does not affect the tool-facing harness context, which continues to expose `state` / `getState` / `setState` / `updateState` alongside `session.state`.

`mastracode` is updated to set browser settings via `session.state.set()`.
