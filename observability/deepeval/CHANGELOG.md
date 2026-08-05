# @mastra/deepeval

## 0.1.0-alpha.0

### Minor Changes

- Added the `@mastra/deepeval` observability exporter to send Mastra traces to Confident AI for evaluation and monitoring. ([#20599](https://github.com/mastra-ai/mastra/pull/20599))

  Register it in your Mastra observability config:

  ```typescript
  import { Mastra } from '@mastra/core';
  import { Observability } from '@mastra/observability';
  import { DeepEvalExporter } from '@mastra/deepeval';

  export const mastra = new Mastra({
    observability: new Observability({
      configs: {
        deepeval: {
          serviceName: 'my-service',
          exporters: [new DeepEvalExporter()],
        },
      },
    }),
  });
  ```

  Set `CONFIDENT_API_KEY` (and optionally `CONFIDENT_TRACE_ENVIRONMENT`) to send traces. Mastra spans map to Confident AI's `AGENT`, `LLM`, `TOOL`, `RETRIEVER`, and `CUSTOM` span types, with model, token counts, tool calls, and metric collections carried through.

### Patch Changes

- Updated dependencies [[`89200ba`](https://github.com/mastra-ai/mastra/commit/89200bafa05444bb7949b363ce7b743e29867561), [`c950138`](https://github.com/mastra-ai/mastra/commit/c950138e72e4f317a40187e3800588731ab790ce), [`063c8b2`](https://github.com/mastra-ai/mastra/commit/063c8b2eb14e4e5ca021779bc33e8c3c031c8604), [`f4e964c`](https://github.com/mastra-ai/mastra/commit/f4e964cad57057301d6bed5c55bcdd730175b941), [`1f7bbd7`](https://github.com/mastra-ai/mastra/commit/1f7bbd7785a8d230aad02454ecabeb4a0b2cc96f), [`e47ff36`](https://github.com/mastra-ai/mastra/commit/e47ff36945720f4ee4caa09f6e83514d7d188608), [`fb9a6ac`](https://github.com/mastra-ai/mastra/commit/fb9a6ac11c9560518742ece60b49d6b062845fd3), [`aa2cec8`](https://github.com/mastra-ai/mastra/commit/aa2cec8501f634d51c2f3ebfb3dd3aa7af8d2ca2), [`2adf8eb`](https://github.com/mastra-ai/mastra/commit/2adf8eb4a70ed2b6cff2dd39281496ea0e025fac), [`8264611`](https://github.com/mastra-ai/mastra/commit/8264611510e421b818bc7395dc2ae4d9c2d518b2), [`44fc98b`](https://github.com/mastra-ai/mastra/commit/44fc98b9d1242aa87a3ab44bdce9e9f12c44d8c9), [`0f2ef41`](https://github.com/mastra-ai/mastra/commit/0f2ef4118da022e4f30dac4e9856cc3a8c97671c)]:
  - @mastra/core@1.57.0-alpha.1
