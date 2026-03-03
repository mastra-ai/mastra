---
'@mastra/core': minor
---

Added `setServer()` public method to the Mastra class, enabling post-construction configuration of server settings. This allows platform tooling to inject server defaults (e.g. auth) into user-created Mastra instances at deploy time.

```typescript
const mastra = new Mastra({ agents: { myAgent } });

// Platform tooling can inject server config after construction
mastra.setServer({ ...mastra.getServer(), auth: new MastraAuthWorkos() });
```
