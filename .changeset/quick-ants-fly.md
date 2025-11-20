---
'@mastra/otel-exporter': major
'@mastra/braintrust': major
'@mastra/langsmith': major
'@mastra/langfuse': major
'@mastra/playground-ui': major
'@mastra/client-js': major
'@mastra/observability': major
'@mastra/arize': major
'@mastra/deployer': major
'@mastra/clickhouse': major
'@mastra/cloudflare': major
'@mastra/inngest': major
'@mastra/mongodb': major
'@mastra/core': major
'@mastra/libsql': major
'mastra': major
'@mastra/mssql': major
'@mastra/pg': major
---

```
import { Mastra } from '@mastra/core';
import { Observability } from '@mastra/observability';  // Explicit import

const mastra = new Mastra({
  ...other_config,
  observability: new Observability({
    default: { enabled: true }
  })  // Instance
});
```

Instead of:

```
import { Mastra } from '@mastra/core';
import '@mastra/observability/init';  // Explicit import

const mastra = new Mastra({
  ...other_config,
  observability: {
    default: { enabled: true }
  }
});
```

Also renamed a bunch of:

- `Tracing` things to `Observability` things.
- `AI-` things to just things.
