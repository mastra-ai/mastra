---
'@mastra/server': minor
---

Added support for signed A2A Agent Cards.

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
        header: {
          issuer: 'mastra',
        },
      },
    },
  },
});
```

Mastra now conditionally signs served A2A Agent Cards via `signAgentCard(...)` when `server.a2a.agentCardSigning` is configured, and the A2A Agent Card response schema now includes the `signatures` array.
