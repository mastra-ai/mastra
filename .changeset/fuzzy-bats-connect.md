---
'create-factory': minor
'@mastra/factory': minor
---

Brought incident.io follow-up intake to full parity with Linear and Jira.

- **Connections**: in-app connect and reconnect for Platform-managed incident.io accounts, runtime discovery of multiple installations, and no more `MASTRA_INCIDENT_IO_CONNECTION_ID`.
- **Auto-ingestion**: observed follow-ups materialize as Work-board cards through configurable event rules (`followUpObserved`, `followUpClosed`), with close events transitioning cards to done/canceled.
- **Agent tools**: board runs get `incidentio_get_follow_up` for reading follow-up details.
- **Board UX**: follow-up cards carry assignee, creator, labels, priority, and incident metadata, plus the same Investigate/Build actions and work-item menu as Linear cards.
- **Routing**: teams choose which Factory and board receive follow-ups; incidents stay unrouted.

```ts
import { IncidentioIntegration } from '@mastra/factory';

const incidentio = new IncidentioIntegration({
  apiKey: process.env.INCIDENT_IO_API_KEY!,
  // Optionally override the default follow-up rules:
  rules: { followUpClosed: null }, // disable automatic close transitions
});
```
