---
'@mastra/core': minor
'mastracode': minor
---

Added experimental tools for connecting Mastra Code agents and sending prioritized signals between freshly advertised peer threads. Cross-agent communication is off by default. Enable it with the "Experimental cross-agent communication" toggle in `/settings`, then restart Mastra Code. Embedded clients can enable it directly:

```typescript
import { createMastraCode } from 'mastracode';

const mastraCode = await createMastraCode({
  crossAgentSignals: true,
});
```

Use `agent_connections_list` to discover peers, `agent_connect` to save an exact peer endpoint, `agent_signal_send` to send a correlated message, and `agent_disconnect` to remove the saved connection. Sends require a currently advertised thread owner, return an error when delivery isn't acknowledged, and retain a bounded sender-side history so sequential retries can reuse the same `messageId`.
