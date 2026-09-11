---
'@mastra/connect': minor
---

Added 33 Neon, Resend, and incident.io tools backed by platform connections. Attach the provider connections to your project, then configure their tools with `connect`:

```ts
import { connect } from '@mastra/connect';

const tools = connect({
  integrations: {
    neon: { allowTools: ['neon_list_projects'] },
    resend: { allowTools: ['resend_send_email'] },
    'incident-io': { allowTools: ['incident_io_list_incidents'] },
  },
});
```
