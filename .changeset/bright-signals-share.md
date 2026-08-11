---
'@mastra/playground-ui': minor
---

Export the Trace Intelligence experience with injectable request and navigation adapters so product hosts can render it outside OSS Studio.

```tsx
import { SankeySignals, TraceIntelligenceProvider } from '@mastra/playground-ui/ee/signals';

<TraceIntelligenceProvider
  cacheScope={`${organizationId}:${projectId}`}
  request={request}
  getTraceHref={traceId => `/traces/${traceId}`}
>
  <SankeySignals entityId={agentId} signalNames={signalNames} />
</TraceIntelligenceProvider>
```
