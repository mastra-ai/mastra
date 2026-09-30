---
'@mastra/code-sdk': minor
'mastracode': patch
---

Added opt-in cross-project agent discovery. Mastra Code instances running in different projects on the same machine can now find each other with `agent_connections_list`, connect with `agent_connect`, and exchange messages with `agent_signal_send`. Before, discovery only reached instances in the same project.

```ts
import { createMastraCode } from '@mastra/code-sdk'

const mastraCode = await createMastraCode({
  unixSocketPubSub: true,
  crossAgentSignals: true,
  crossProjectAgentSignals: true,
})
```

The option defaults to the `signals.experimentalCrossProjectAgentSignals` setting, which is off. When it's off, nothing changes. Any local process running as the same user can discover and message advertised agents while it's on. Set `MASTRACODE_SIGNALS_SOCKET_ROOT` to an absolute path to keep an instance or a test away from the shared `/tmp/mc` directory.
