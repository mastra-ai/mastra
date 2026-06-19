---
'@mastra/core': minor
'mastracode': patch
---

Replaced `Harness.switchMode()` with `harness.session.mode.switch()`. Switching modes now lives on the session, alongside the active mode/model state it already owns.

**Before**

```typescript
await harness.switchMode({ modeId: 'build' });
```

**After**

```typescript
await harness.session.mode.switch({ modeId: 'build' });
```
