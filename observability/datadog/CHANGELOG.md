# @mastra/datadog

## 1.0.0-beta.2

### Minor Changes

- Added a Datadog LLM Observability exporter for Mastra applications. ([#11305](https://github.com/mastra-ai/mastra/pull/11305))

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

### Patch Changes

- Updated dependencies [[`08766f1`](https://github.com/mastra-ai/mastra/commit/08766f15e13ac0692fde2a8bd366c2e16e4321df), [`ae8baf7`](https://github.com/mastra-ai/mastra/commit/ae8baf7d8adcb0ff9dac11880400452bc49b33ff), [`cfabdd4`](https://github.com/mastra-ai/mastra/commit/cfabdd4aae7a726b706942d6836eeca110fb6267), [`a0e437f`](https://github.com/mastra-ai/mastra/commit/a0e437fac561b28ee719e0302d72b2f9b4c138f0), [`bec5efd`](https://github.com/mastra-ai/mastra/commit/bec5efde96653ccae6604e68c696d1bc6c1a0bf5), [`9eedf7d`](https://github.com/mastra-ai/mastra/commit/9eedf7de1d6e0022a2f4e5e9e6fe1ec468f9b43c)]:
  - @mastra/core@1.0.0-beta.21

## 1.0.0-beta.1

### Major Changes

- Initial release of DatadogExporter for Mastra LLM Observability
