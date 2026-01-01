---
'@mastra/datadog': minor
'@mastra/server': patch
---

New Datadog LLM Observability exporter for Mastra applications.

This exporter integrates with Datadog's LLM Observability product to provide comprehensive tracing and monitoring for AI/LLM applications built with Mastra.

- **LLM Observability Integration**: Exports traces to Datadog's dedicated LLM Observability product
- **Dual Mode Support**: Works with direct HTTPS (agentless) or through a local Datadog Agent
- **Span Type Mapping**: Automatically maps Mastra span types to Datadog LLMObs kinds (llm, agent, tool, workflow, task)
- **Message Formatting**: LLM inputs/outputs are formatted as message arrays for proper visualization in Datadog
- **Token Metrics**: Captures inputTokens, outputTokens, totalTokens, reasoningTokens, and cached tokens
- **Evaluation Scoring**: Submit quality scores via `addScoreToTrace()` method
- **User/Session Tracking**: Configure `defaultUserId` and `defaultSessionId` for all spans
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

This is an initial beta release. The API is stable but may receive enhancements in future versions.

Also, a bug was patched in the mastra server package to prevent tags from being stripped from exported traces. This fix may be implemented differently in ongoing work implementing Mastra's tagging capabilities.
