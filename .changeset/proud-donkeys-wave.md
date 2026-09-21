---
'@mastra/connect': patch
---

Extended the platform proxy runtime and provider generator so more upstream Nango template patterns can be generated into `@mastra/connect` tools: template input validation (`zodValidateInput`) now runs inside the proxy runtime, and actions that authenticate with the raw connection credential (for example token-introspection endpoints) are generated instead of skipped, with the credential fetched from the platform only for the specific actions that read it. Agents consume the resulting tools through the normal provider workflow — no API changes:

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
