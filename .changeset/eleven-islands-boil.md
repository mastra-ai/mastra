---
'@mastra/core': minor
'mastracode': patch
---

Replaced `Harness.switchModel()` with `harness.session.model.switch()`. Model switching now lives on the session, alongside the active mode/model state it already owns.

**Before**

```typescript
await harness.switchModel({ modelId: 'openai/gpt-5' });
```

**After**

```typescript
await harness.session.model.switch({ modelId: 'openai/gpt-5' });
```
