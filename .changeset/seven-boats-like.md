---
'@mastra/core': minor
'@mastra/deployer': minor
---

Added path-specific server CORS configuration so credentialed cross-origin access can be limited to selected routes.

```ts
new Mastra({
  server: {
    cors: {
      '*': { origin: '*' },
      '/api/agents/support-agent/channels/web/*': {
        origin: ['https://customer-saas.example'],
        credentials: true,
      },
    },
  },
});
```
