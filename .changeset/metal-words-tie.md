---
'@mastra/core': minor
---

Added an optional `getRoutes()` method to `SignalProvider`. Routes it returns are added to `server.apiRoutes` automatically when the agent is registered, so webhook and OAuth routes for a signal provider no longer need manual server config.

```ts
class AcmeSignals extends SignalProvider<'acme'> {
  readonly id = 'acme' as const;

  getRoutes() {
    return [registerApiRoute('/acme/webhook', { method: 'POST', handler: async c => c.json({ ok: true }) })];
  }
}

// Before: server: { apiRoutes: acme.getRoutes() }
// After: just add the provider to the agent
const agent = new Agent({ /* ... */ signals: [new AcmeSignals()] });
export const mastra = new Mastra({ agents: { agent } });
```
