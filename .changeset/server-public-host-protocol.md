---
'@mastra/core': minor
'@mastra/deployer': minor
---

Add `server.publicHost` and `server.publicProtocol` options for Studio in cloud deployments

When deploying to cloud environments (e.g., Google Cloud Run), `server.host` must be `0.0.0.0` for the container to accept traffic, but Studio needs the actual public domain to make API calls from the browser. These new options decouple the server bind address from the Studio API URL.

```typescript
export const mastra = new Mastra({
  server: {
    host: '0.0.0.0',
    publicHost: 'my-app.run.app',
    publicProtocol: 'https',
  },
});
```

Both options are optional and fall back to existing behavior when not set.
