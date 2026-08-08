---
'@mastra/cloudflare-workflows': minor
---

Added Cloudflare Workflows durable execution for Mastra agents, including native retries, suspend and resume events, abort, recovery status, request context, and actor propagation.

Set `maxSteps: false` when Cloudflare should keep the agent loop durable until completion or abort instead of enforcing a numeric step ceiling.

```ts
import { createCloudflareWorkflowAgent } from '@mastra/cloudflare-workflows'

const durableAgent = createCloudflareWorkflowAgent({
  agent,
  workflow: env.AGENT_WORKFLOW,
})
```

Cloudflare Worker entrypoints can import the Worker-safe orchestration surface without bundling the Node-side Mastra runtime:

```ts
import {
  createCloudflareWorkflowStepExecutor,
  runCloudflareWorkflowAgent,
} from '@mastra/cloudflare-workflows/worker'
```
