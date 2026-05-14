### 12.12 Observational Memory

```ts
// Inspect or change OM models for this session only.
const observerModelId = session.om.getObserverModelId();
await session.om.switchObserverModel({ model: 'anthropic/claude-haiku-4-5' });

// Read the current OM record for the session's resource.
const record = await session.om.getRecord();
```
