---
"@mastra/core": patch
"@mastra/server": patch
---

Agent network execution now fails closed when Fine-Grained Authorization is enabled.

When Fine-Grained Authorization is enabled, `agent.network()` calls must include a trusted resource id in `requestContext`. Calls without that resource id are denied. If Fine-Grained Authorization is disabled, no caller changes are required.

```ts
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';

const requestContext = new RequestContext();
requestContext.set('user', { id: 'user-123' });
requestContext.set(MASTRA_RESOURCE_ID_KEY, 'resource-456');

await agent.network('Research this request', {
  requestContext,
});
```

Network resume and network tool-call approval routes now use the same request context ownership checks.
