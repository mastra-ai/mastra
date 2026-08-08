---
'@mastra/cloudflare-workflows': minor
---

Added Cloudflare Workflows durable execution for Mastra agents, including native retries, suspend and resume events, abort, recovery status, request context, and actor propagation.

```ts
import { createCloudflareWorkflowAgent } from '@mastra/cloudflare-workflows'

const durableAgent = createCloudflareWorkflowAgent({
  agent,
  workflow: env.AGENT_WORKFLOW,
})
```
