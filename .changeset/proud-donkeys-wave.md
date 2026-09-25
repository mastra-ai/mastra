---
'@mastra/connect': patch
---

`@mastra/connect` providers now expose more tools from each connected service, including actions that authenticate with the connection's own credential (token introspection, for example). No API changes — agents pick up the additional tools through the normal provider workflow:

```typescript
import { Agent } from '@mastra/core/agent';
import { connect } from '@mastra/connect';

const assistant = new Agent({
  id: 'assistant',
  name: 'Assistant',
  instructions: 'Help with connected services.',
  model: 'anthropic/claude-sonnet-4-6',
  tools: connect(), // tools for every connected provider, resolved per request
});
```
