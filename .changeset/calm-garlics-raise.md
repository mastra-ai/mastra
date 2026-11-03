---
'@mastra/factory': minor
---

Added Google Vertex AI as an operator-enabled deployment model provider. Enable it to let Factory tenants use the deployment's Application Default Credentials:

```ts
const factory = new MastraFactory({
  deploymentModelProviders: ['google-vertex'],
  // ...other Factory configuration
});
```
