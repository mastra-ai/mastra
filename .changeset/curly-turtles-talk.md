---
'@mastra/core': minor
'mastracode': patch
---

Moved the observational-memory model accessors off the Harness onto `session.om`. Reading and switching the observer/reflector models and reading observation/reflection thresholds now live on the session, next to the state they read and write.

**Before**

```typescript
const observer = harness.getObserverModelId();
await harness.switchObserverModel({ modelId: 'openai/gpt-4o' });
```

**After**

```typescript
const observer = harness.session.om.observerModelId();
await harness.session.om.switchObserverModel({ modelId: 'openai/gpt-4o' });
```

Removed `Harness.getObserverModelId`, `getReflectorModelId`, `getObservationThreshold`, `getReflectionThreshold`, `getResolvedObserverModel`, `getResolvedReflectorModel`, `switchObserverModel`, and `switchReflectorModel`.

`mastracode` is updated to consume the new API: the `/om` command and status line now read and switch observer/reflector models via `session.om`.
