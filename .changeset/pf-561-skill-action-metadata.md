---
"@mastra/core": minor
---

Harness skills can now declare action metadata so desktop hosts can build command palettes and action catalogs with keyboard shortcuts, input/output forms, artifact previews, and permission summaries.

```ts
import type { HarnessSkill } from '@mastra/core/harness/v1';

const skill: HarnessSkill = {
  name: 'open-ticket',
  description: 'Open a support ticket',
  instructions: 'Open the ticket from the provided id.',
  action: {
    displayName: 'Open ticket',
    shortcuts: [{ id: 'ticket.open', keys: ['mod+o'] }],
    inputSchema: { type: 'object', properties: { ticketId: { type: 'string' } } },
    artifactTypes: ['application/vnd.mastra.ticket'],
    permissions: { tools: ['tickets.open'], networkScopes: ['api.example.test'] },
  },
};
```
