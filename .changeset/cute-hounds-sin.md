---
'@mastra/connect': minor
---

Added broad Resend and incident.io tool coverage backed by Platform connections. Resend covers email operations and account resources such as domains, templates, audiences, contacts, broadcasts, and webhooks. incident.io covers incident response, alerts, on-call data, teams, users, postmortems, and catalog reads.

```ts
import { connect } from '@mastra/connect';

const tools = connect({
  projectId: process.env.MASTRA_PROJECT_ID,
  client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
  integrations: {
    resend: { allowTools: ['resend_send_email', 'resend_get_email'] },
    'incident-io': { allowTools: ['incident_io_list_incidents'] },
  },
});
```
