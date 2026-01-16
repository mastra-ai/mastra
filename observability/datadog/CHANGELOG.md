# @mastra/datadog

## 1.0.0-beta.4

### Patch Changes

- Updated dependencies [[`c8417b4`](https://github.com/mastra-ai/mastra/commit/c8417b41d9f3486854dc7842d977fbe5e2166264), [`dd4f34c`](https://github.com/mastra-ai/mastra/commit/dd4f34c78cbae24063463475b0619575c415f9b8)]:
  - @mastra/core@1.0.0-beta.23
  - @mastra/observability@1.0.0-beta.12

## 1.0.0-beta.3

### Patch Changes

- Make Datadog exporter zero-config compatible ([#11816](https://github.com/mastra-ai/mastra/pull/11816))

  The Datadog exporter can now be instantiated without any configuration by reading credentials from environment variables:
  - `DD_LLMOBS_ML_APP` - ML application name
  - `DD_API_KEY` - Datadog API key
  - `DD_SITE` - Datadog site (defaults to `datadoghq.com`)
  - `DD_ENV` - Environment name

  ```typescript
  // Zero-config usage - reads from environment variables
  const exporter = new DatadogExporter();
  ```

- Fixed missing peer dependency warnings for `@openfeature/core` and `@openfeature/server-sdk` ([#11966](https://github.com/mastra-ai/mastra/pull/11966))

  Added `@openfeature/core` and `@openfeature/server-sdk` as optional peer dependencies to resolve warnings that occur during installation. These are transitive dependencies from `dd-trace` and are now properly declared.

  **Troubleshooting documentation added:**
  - Native module ABI mismatch errors (Node.js version compatibility with `dd-trace`)
  - Bundler externals configuration for `dd-trace` and native modules

- Updated dependencies [[`ebae12a`](https://github.com/mastra-ai/mastra/commit/ebae12a2dd0212e75478981053b148a2c246962d), [`c61a0a5`](https://github.com/mastra-ai/mastra/commit/c61a0a5de4904c88fd8b3718bc26d1be1c2ec6e7), [`69136e7`](https://github.com/mastra-ai/mastra/commit/69136e748e32f57297728a4e0f9a75988462f1a7), [`449aed2`](https://github.com/mastra-ai/mastra/commit/449aed2ba9d507b75bf93d427646ea94f734dfd1), [`eb648a2`](https://github.com/mastra-ai/mastra/commit/eb648a2cc1728f7678768dd70cd77619b448dab9), [`0131105`](https://github.com/mastra-ai/mastra/commit/0131105532e83bdcbb73352fc7d0879eebf140dc), [`9d5059e`](https://github.com/mastra-ai/mastra/commit/9d5059eae810829935fb08e81a9bb7ecd5b144a7), [`ef756c6`](https://github.com/mastra-ai/mastra/commit/ef756c65f82d16531c43f49a27290a416611e526), [`b00ccd3`](https://github.com/mastra-ai/mastra/commit/b00ccd325ebd5d9e37e34dd0a105caae67eb568f), [`3bdfa75`](https://github.com/mastra-ai/mastra/commit/3bdfa7507a91db66f176ba8221aa28dd546e464a), [`e770de9`](https://github.com/mastra-ai/mastra/commit/e770de941a287a49b1964d44db5a5763d19890a6), [`52e2716`](https://github.com/mastra-ai/mastra/commit/52e2716b42df6eff443de72360ae83e86ec23993), [`27b4040`](https://github.com/mastra-ai/mastra/commit/27b4040bfa1a95d92546f420a02a626b1419a1d6), [`610a70b`](https://github.com/mastra-ai/mastra/commit/610a70bdad282079f0c630e0d7bb284578f20151), [`8dc7f55`](https://github.com/mastra-ai/mastra/commit/8dc7f55900395771da851dc7d78d53ae84fe34ec), [`8379099`](https://github.com/mastra-ai/mastra/commit/8379099fc467af6bef54dd7f80c9bd75bf8bbddf), [`b06be72`](https://github.com/mastra-ai/mastra/commit/b06be7223d5ef23edc98c01a67ef713c6cc039f9), [`8c0ec25`](https://github.com/mastra-ai/mastra/commit/8c0ec25646c8a7df253ed1e5ff4863a0d3f1316c), [`ff4d9a6`](https://github.com/mastra-ai/mastra/commit/ff4d9a6704fc87b31a380a76ed22736fdedbba5a), [`69821ef`](https://github.com/mastra-ai/mastra/commit/69821ef806482e2c44e2197ac0b050c3fe3a5285), [`1ed5716`](https://github.com/mastra-ai/mastra/commit/1ed5716830867b3774c4a1b43cc0d82935f32b96), [`4186bdd`](https://github.com/mastra-ai/mastra/commit/4186bdd00731305726fa06adba0b076a1d50b49f), [`7aaf973`](https://github.com/mastra-ai/mastra/commit/7aaf973f83fbbe9521f1f9e7a4fd99b8de464617)]:
  - @mastra/core@1.0.0-beta.22
  - @mastra/observability@1.0.0-beta.11

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
