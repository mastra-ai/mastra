---
'@mastra/editor': patch
'@mastra/server': patch
'@mastra/client-js': patch
---

Align stored-agent durable configuration with resumable streams: accept a boolean or `{ cleanupTimeoutMs }` and remove the checkpoint execution `maxSteps` option. Stored `durable: true` agents now hydrate as plain agents with resumable streams, not durable execution wrappers. Use an explicit code-defined `createDurableAgent({ agent })` wrapper when checkpoint persistence and recovery are required.

Before, a stored agent version enabled durable execution with:

```json
{
  "durable": true
}
```

After, move that agent's definition into code (`agentConfig` below) and register an explicit wrapper:

```ts
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';

const agent = createDurableAgent({ agent: new Agent(agentConfig) });
const mastra = new Mastra({ agents: { agent } });
```

Crash recovery requires persistent workflow storage. Enable automatic recovery, or persist `running` snapshots with `shouldPersistSnapshot` and recover runs manually. Changing only the stored `durable` field no longer enables checkpoint execution.
