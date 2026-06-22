---
'@mastra/core': minor
'mastracode': patch
---

Replaced `Harness.getModelName()` and `Harness.getFullModelId()` with session accessors. The full model id is read via the existing `harness.session.model.get()`, and the short display name moves to a new `harness.session.model.displayName()`.

**Before**

```typescript
const name = harness.getModelName();
const fullId = harness.getFullModelId();
```

**After**

```typescript
const name = harness.session.model.displayName();
const fullId = harness.session.model.get();
```

`mastracode` is updated to consume the new API: the TUI status line and message renderer now read the model id via `harness.session.model.get()`.
