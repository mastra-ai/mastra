---
'@mastra/datadog': minor
---

Added a Datadog LLM Observability exporter for Mastra applications.

This exporter integrates with Datadog's LLM Observability product to provide comprehensive tracing and monitoring for AI/LLM applications built with Mastra.

- **LLM Observability Integration**: Exports traces to Datadog's dedicated LLM Observability product
- **Dual Mode Support**: Works with direct HTTPS (agentless) or through a local Datadog Agent
- **Span Type Mapping**: Automatically maps Mastra span types to Datadog LLMObs kinds (llm, agent, tool, workflow, task)
- **Message Formatting**: LLM inputs/outputs are formatted as message arrays for proper visualization in Datadog
- **Token Metrics**: Captures inputTokens, outputTokens, totalTokens, reasoningTokens, and cached tokens
- **Error Tracking**: Error spans include detailed error info (message, ID, domain, category)
- **Hierarchical Traces**: Tree-based span emission preserves parent-child relationships

Required settings:

- `mlApp`: Groups traces under an ML application name (required)
- `apiKey`: Datadog API key (required for agentless mode)

Optional settings:

- `site`: Datadog site (datadoghq.com, datadoghq.eu, us3.datadoghq.com)
- `agentless`: true for direct HTTPS (default), false for local agent
- `service`, `env`: APM tagging
- `integrationsEnabled`: Enable dd-trace auto-instrumentation (default: false)

```typescript
import { Mastra } from '@mastra/core';
import { Observability } from '@mastra/observability';
import { DatadogExporter } from '@mastra/datadog';

const mastra = new Mastra({
  observability: new Observability({
    configs: {
      datadog: {
        serviceName: 'my-service',
        exporters: [
          new DatadogExporter({
            mlApp: 'my-llm-app',
            apiKey: process.env.DD_API_KEY,
          }),
        ],
      },
    },
  }),
});
```

This is an initial experimental beta release. Breaking changes may occur in future versions as the API evolves.
