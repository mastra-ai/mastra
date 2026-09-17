---
'@mastra/core': minor
---

Added opt-in A2A protocol selection with `protocolVersion: 'auto'`. Remote agent cards select a compatible JSON-RPC interface, preferring v1.0 over v0.3. Legacy cards without interface advertisements use v0.3. The default remains v0.3, and explicit protocol settings are unchanged.

Instead of pinning each remote's protocol:

```typescript
const remoteAgent = new A2AAgent({
  url: 'https://agent.example.com/.well-known/agent-card.json',
  protocolVersion: '1.0',
});
```

Let the remote card determine the protocol:

```typescript
const remoteAgent = new A2AAgent({
  url: 'https://agent.example.com/.well-known/agent-card.json',
  protocolVersion: 'auto',
});
```

Active and resumable runs retain their selected protocol and endpoint when the cached agent card is refreshed.
