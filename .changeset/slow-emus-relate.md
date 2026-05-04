---
'@mastra/datadog': minor
'@mastra/observability': patch
---

Added a new `DatadogBridge` integration for Mastra tracing so Datadog can keep auto-instrumented HTTP, database, and framework spans nested under the agent, workflow, model, and tool spans that triggered them.

```typescript
import tracer from 'dd-trace';

tracer.init({
  service: process.env.DD_SERVICE || 'my-mastra-app',
  env: process.env.DD_ENV || 'production',
});

import { Mastra } from '@mastra/core';
import { Observability } from '@mastra/observability';
import { DatadogBridge } from '@mastra/datadog';

const mastra = new Mastra({
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'my-mastra-app',
        bridge: new DatadogBridge({
          mlApp: process.env.DD_LLMOBS_ML_APP!,
        }),
      },
    },
  }),
});
```
