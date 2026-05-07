---
'@mastra/core': patch
---

Added A2A Agent Card signing config types for server configuration.

**Example**

```ts
const mastra = new Mastra({
  server: {
    a2a: {
      agentCardSigning: {
        privateKey: process.env.A2A_AGENT_CARD_PRIVATE_KEY!,
        protectedHeader: {
          alg: 'ES256',
          kid: 'agent-card-key',
        },
      },
    },
  },
});
```
