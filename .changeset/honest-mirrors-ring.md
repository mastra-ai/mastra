---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/deployer': patch
'@mastra/server': patch
---

Added support for A2A protocol v1 while keeping v0.3 compatible

Mastra now speaks the A2A (Agent-to-Agent) protocol v1 in addition to v0.3. The `A2AAgent` client reads a remote agent's card, picks a supported interface, and negotiates the protocol version automatically — defaulting to v1 and falling back to v0.3 for older peers. Existing v0.3 agents keep working with no changes.

The client now sends v1 message shapes and includes an `A2A-Version` header:

```ts
import { A2AAgent } from '@mastra/core/a2a';

const agent = new A2AAgent({ url: 'https://remote-agent.example.com' });

// Same public API as before — the v1/v0.3 negotiation happens under the hood
const result = await agent.generate('Summarize this document');
```

This upgrades the underlying `@a2a-js/sdk` dependency to v1. If you import A2A types directly from `@mastra/core/a2a`, note that v1 renamed and reshaped several of them (for example the agent card now exposes `supportedInterfaces` instead of a top-level `url`, and the extended-card flag moved onto `capabilities`).
