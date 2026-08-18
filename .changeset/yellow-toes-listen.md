---
'@mastra/core': minor
---

Added invoker-bound tool provider connections. Providers now receive the connection kind, toolkit, and live RequestContext so they can execute as the authenticated user without coupling provider identity to the Memory resource. The stored connection ID continues to select the exact provider account.

```typescript
import type { ToolProviders } from '@mastra/core/tool-provider';

const toolProviders: ToolProviders = {
  crm: {
    tools: {
      CREATE_LEAD: { toolkit: 'salesforce' },
    },
    connections: {
      salesforce: [
        {
          kind: 'invoker',
          toolkit: 'salesforce',
          connectionId: 'connected-account-id',
        },
      ],
    },
  },
};
```
