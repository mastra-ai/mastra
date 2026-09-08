---
'@mastra/factory': minor
---

Added incident.io Intake integrations for direct API keys and Mastra Platform connections, including incidents, follow-ups, custom board imports, and periodic reconciliation of imported item state. The shared incident.io client also provides typed read access to actions, incident updates, alerts, escalations, catalog data, teams, schedules, and policy findings for future integrations.

```typescript
import { IncidentioIntegration } from '@mastra/factory/integrations/incidentio/integration';

const integration = new IncidentioIntegration({ apiKey: process.env.INCIDENT_IO_API_KEY });
```
