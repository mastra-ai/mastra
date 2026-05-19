---
'@mastra/core': minor
'@mastra/deployer': minor
---

Added route-specific CORS configuration so credentialed cross-origin access can be limited to selected custom routes and channel webhooks.

```ts
registerApiRoute('/customer-webhook', {
  method: 'POST',
  cors: {
    origin: ['https://customer-saas.example'],
    credentials: true,
  },
  handler: async c => c.json({ ok: true }),
});
```

```ts
new Agent({
  id: 'support-agent',
  name: 'Support Agent',
  instructions: '...',
  model,
  channels: {
    adapters: {
      web: {
        adapter: createWebAdapter(),
        cors: {
          origin: ['https://customer-saas.example'],
          credentials: true,
        },
      },
    },
  },
});
```

Use `server.cors` for one global CORS policy across the server:

```ts
new Mastra({
  server: {
    cors: {
      origin: '*',
    },
  },
});
```
