---
"@mastra/core": patch
"@mastra/libsql": patch
---

Added: You can now route provider callbacks in Harness channels.

```ts
await storage.resolveProviderCallbackBinding({
  id: 'slack-installation-team-1',
  providerId: 'slack',
  selectorKind: 'installation',
  selectorValue: 'team-1',
  harnessName: 'support',
  channelId: 'support-slack',
  status: 'active',
  origin: { route: 'slack/events' },
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
```

The storage contract also keeps callback binding resolution idempotent and reports selector conflicts for implementers.
