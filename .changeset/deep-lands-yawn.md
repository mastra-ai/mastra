---
'@mastra/connect': minor
---

Added observability for outbound Connect HTTP calls. When tracing is enabled, every Mastra Platform API call and every vendor call routed through the connection proxy now appears as a child span under the active span (e.g. the tool call span), with method, a safe route template, connection id, and response status — so a failing provider tool call can be traced end to end inside the agent trace. Spans never record query strings, headers, bodies, or vendor path segments, and apps without observability configured are unaffected.

No new API — configure observability on your Mastra instance as usual and Connect tool calls are traced automatically:

```ts
import { Mastra } from '@mastra/core';
import { tools } from '@mastra/connect';

const mastra = new Mastra({
  agents: { myAgent },
  observability: { default: { enabled: true } },
});

// an agent using Connect tools now produces traces like:
// TOOL_CALL linear_create_issue
//   └─ connect.proxy POST /v2/connections/{connectionId}/proxy/*  (status: 201)
```
