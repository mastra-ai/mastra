---
'@mastra/factory': minor
---

Moved Linear event rules into `LinearIntegration` and `PlatformLinearIntegration`. Built-in handlers remain enabled without configuration. Constructor `rules` accept replacements or `null` to disable an event; omitted events retain defaults.

Move former global `rules.linear[event].onEvent` values to the owning integration constructor:

```typescript
// Before: global Factory overrides
const overrides = { linear: { issueClosed: { onEvent: null } } };

// After: integration constructor options
const linear = new PlatformLinearIntegration({ rules: { issueClosed: null } });
```

Both direct and platform integrations use their own handlers for fetched issues and reconciliation while preserving shared audit metadata.
