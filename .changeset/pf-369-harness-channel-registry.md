---
'@mastra/core': minor
---

Added Harness channel registration validation so configured channel bindings either resolve to stable provider-backed identities or fail early with `HarnessConfigError` before channel workers use them.

```ts
const harness = new Harness({
  modes: [{ id: 'default', agentId: 'default' }],
  defaultModeId: 'default',
  channels: {
    support: {
      providerId: 'slack',
      adapter,
      ingress,
    },
  },
});

new Mastra({
  agents,
  channels: { slack: slackProvider },
  harnesses: { primary: harness },
});

harness.getChannelBinding('support')?.durableId; // "primary:support:support"
```
