---
'@mastra/factory': minor
---

Added incident.io Intake integrations for direct API keys and Mastra Platform connections.

**Intake**

- Import incidents and follow-ups onto any installed board, including custom boards.
- Include status, severity, ownership, labels, descriptions, and incident metadata on imported items.
- Refresh imported items when provider state changes.

**API client**

- Added typed read access to actions, incident updates, alerts, escalations, catalog data, teams, schedules, and policy findings.

```typescript
import { IncidentioIntegration } from '@mastra/factory/integrations/incidentio/integration';

const integration = new IncidentioIntegration({ apiKey: process.env.INCIDENT_IO_API_KEY });
```
