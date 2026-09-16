---
'@mastra/core': minor
---

Added A2A v1.0 remote subagent delegation with explicit protocol selection on `A2AAgent`. Existing integrations continue to use v0.3 by default.

```typescript
const remoteAgent = new A2AAgent({
  url: 'https://example.com/.well-known/agent-card.json',
  protocolVersion: '1.0',
});
```
