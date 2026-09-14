---
'@mastra/core': minor
---

**Added** dual A2A Protocol version support for remote agent delegation.

`A2AAgent` now discovers the remote agent card and selects a supported JSON-RPC interface automatically. Pin `protocolVersion` to `0.3` or `1.0` when a remote agent must use one version.

```ts
import { A2AAgent } from '@mastra/core/a2a'

const remoteAgent = new A2AAgent({
  url: 'https://agent.example.com/api/.well-known/weather-agent/agent-card.json',
  protocolVersion: 'auto',
})
```

**Behavior changes for existing `A2AAgent` users** (not purely additive):

- The default `protocolVersion` is now `'auto'`. The execution URL is resolved by negotiating the agent card's advertised interfaces (`selectA2AInterface`) rather than reading the top-level `card.url` directly. A 0.3 card that exposes a top-level `url` (with `protocolVersion` absent or `0.3`) is still treated as a 0.3 interface, so legacy bare-`url` 0.3 remotes continue to work. Pin `protocolVersion: '0.3'` for any remote whose card advertises a different/newer version but should still be reached over 0.3.
- Against a remote that advertises **both** 0.3 and 1.0 (e.g. another dual-version Mastra server), `'auto'` now selects the first advertised interface — `1.0`. Existing delegations that previously spoke 0.3 to such a server will negotiate 1.0. Pin `protocolVersion: '0.3'` to keep the prior wire version.
- Passing an `A2A-Version` request header that conflicts with the resolved/pinned `protocolVersion` (including `'auto'`) now throws at construction instead of being silently ignored.
