---
'@mastra/deployer-cloud': minor
---

Add studio option to CloudDeployer for bundling playground UI

```typescript
const deployer = new CloudDeployer({ studio: true });
```

When enabled, copies playground assets to the build output and configures the server to serve the studio UI.
