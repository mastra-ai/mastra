---
'@mastra/factory': patch
---

Added incident.io intake for self-managed servers: the generated Factory Server now wires the incident.io integration from INCIDENT_IO_API_KEY, and the incident.io status route reports the credential mode so clients can tell a deployment API key from Platform-managed connections.

```ts
import { MastraFactory } from '@mastra/factory';
import { IncidentioIntegration } from '@mastra/factory/integrations/incidentio/integration';

const factory = new MastraFactory({
  // ...
  integrations: [new IncidentioIntegration({ apiKey: process.env.INCIDENT_IO_API_KEY! })],
});
```
