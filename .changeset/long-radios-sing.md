---
'@mastra/server': minor
---

**Added** dual A2A Protocol exposure for Mastra agents.

Servers expose both A2A 0.3 and 1.0 by default on the same agent card and execution URL. Configure `server.a2a.protocolVersions` server-wide, or override the list per agent. Version `1.0` requests use official PascalCase methods and v1 wire shapes.

```ts
import { Mastra } from '@mastra/core/mastra'

export const mastra = new Mastra({
  server: {
    a2a: {
      protocolVersions: ['1.0', '0.3'],
      agents: {
        'legacy-agent': { protocolVersions: ['0.3'] },
      },
    },
  },
})
```
