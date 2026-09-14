---
'@mastra/client-js': minor
---

**Added** version selection for A2A client requests.

Use `getA2A(agentId, { protocolVersion: '1.0' })` for the A2A v1.0 wire protocol. Existing `getA2A(agentId)` calls remain on v0.3, and `getA2AV1()` stays available as a compatibility alias.

```ts
import { MastraClient } from '@mastra/client-js'

const client = new MastraClient({ baseUrl: 'https://agent.example.com' })
const a2a = client.getA2A('weather-agent', { protocolVersion: '1.0' })
```

The default and pinned (`'0.3'`/`'1.0'`) overloads return the client synchronously. `{ protocolVersion: 'auto' }` fetches the agent card to negotiate a version, so it returns a `Promise` that must be awaited:

```ts
const a2a = await client.getA2A('weather-agent', { protocolVersion: 'auto' })
```
