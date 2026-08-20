---
'@mastra/factory': patch
---

Factory projects now have their own configurable observational-memory settings. Board runs and channel sessions hydrate from the factory project's shared settings row (falling back to built-in defaults) instead of any individual user's personal configuration, and the OM config routes accept a `factoryId` to read and update the factory-scoped row. In settings, a dedicated Memory page shows the factory-wide and personal observational-memory configuration side by side, so factory defaults and personal chat settings are edited separately.

To read or update the factory-scoped configuration, pass the factory project id:

```ts
await fetch(`/web/config/om?factoryId=${factoryId}`);
await fetch(`/web/config/om/observer/model`, {
  method: 'PUT',
  body: JSON.stringify({ modelId: 'anthropic/claude-haiku-4-5', factoryId }),
});
```

Requests without `factoryId` keep operating on the caller's personal settings.
