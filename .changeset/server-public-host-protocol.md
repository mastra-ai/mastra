---
'@mastra/core': minor
'@mastra/deployer': minor
---

Add `server.publicHost`, `server.publicProtocol`, and `server.publicPort` options for Studio in cloud deployments

When deploying to cloud environments (e.g., Google Cloud Run), `server.host` must be `0.0.0.0` for the container to accept traffic, and the internal port often differs from the external one (e.g., 8080 internally vs 443 externally). Studio needs the actual public domain, protocol, and port to make API calls from the browser. These new options decouple the server bind configuration from the Studio API URL.

```typescript
export const mastra = new Mastra({
  server: {
    host: '0.0.0.0',
    port: 8080,
    publicHost: 'my-app.run.app',
    publicProtocol: 'https',
    publicPort: 443,
  },
});
```

All three options are optional and fall back to existing behavior when not set.
