---
'@mastra/connect': patch
---

Generated `@mastra/connect` providers now cover more of the upstream template catalog. Actions that authenticate with the raw connection credential — token-introspection endpoints, for example — are generated instead of skipped, and actions that validate their input with the template validation helper are generated too. The credential is fetched from the platform only for the specific actions that read it. Under the hood this extends the platform proxy runtime and the provider generator; agents consume the resulting tools through the normal provider workflow with no API changes:

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
