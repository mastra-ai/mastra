---
'@mastra/code-sdk': minor
---

Agents in different projects on the same machine can now find each other. With cross-agent communication on (`crossAgentSignals: true` or the `signals.experimentalCrossAgentSignals` setting), `agent_connections_list` lists Mastra Code instances in every project, and `agent_connect` and `agent_signal_send` reach them. Before, the list only showed instances in the same project.

```ts
import { createMastraCode } from '@mastra/code-sdk'

const mastraCode = await createMastraCode({
  unixSocketPubSub: true,
  crossAgentSignals: true,
})
```

Any local process running as the same user can discover and message advertised agents. Set `MASTRACODE_SIGNALS_SOCKET_ROOT` to an absolute path to keep an instance or a test away from the shared `/tmp/mc` directory.

Also fixed signal sockets piling up under `/tmp/mc`. Every agent discovery request used to leave an open socket, and often a socket file, behind, so long-running instances could accumulate thousands. One-off discovery replies now close as soon as they're answered. Headless `mastracode --prompt` runs also close their signal sockets on exit instead of leaving the files behind.
