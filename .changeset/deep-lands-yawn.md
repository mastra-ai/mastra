---
'@mastra/connect': minor
---

Added tracing for outbound Connect HTTP calls.

When observability is enabled, every Mastra Platform API call and every vendor call routed through the connection proxy appears as a child span under the active span, such as the tool call span. Each span records the HTTP method, a safe route template, the connection id, and the response status. Spans never record query strings, headers, bodies, or vendor path segments. Apps without observability configured are unaffected.

No new API — configure observability on your Mastra instance as usual:

```ts
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Observability, MastraStorageExporter } from '@mastra/observability';
import { tools } from '@mastra/connect';

const myAgent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  instructions: 'You manage Linear issues.',
  model: 'openai/gpt-5.1',
  tools: tools({
    projectId: process.env.MASTRA_PROJECT_ID,
    client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
    integrations: ['linear'],
  }),
});

const mastra = new Mastra({
  agents: { myAgent },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [new MastraStorageExporter()],
      },
    },
  }),
});

// an agent using Connect tools now produces traces like:
// TOOL_CALL linear_create_issue
//   └─ connect.proxy POST /v2/connections/{connectionId}/proxy/*  (status: 201)
```
