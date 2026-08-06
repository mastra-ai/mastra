# @mastra/deepeval

## 0.1.0

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

- Updated dependencies [[`8d2399b`](https://github.com/mastra-ai/mastra/commit/8d2399b638f8e0945cf2cda0187dbea8dcf0b784), [`c8002da`](https://github.com/mastra-ai/mastra/commit/c8002da7775c468e2965b6ff5f82045450fa8cb9), [`92be47f`](https://github.com/mastra-ai/mastra/commit/92be47fbd26ffccec0e2131ef7c1d9e70dd5ef4a), [`89200ba`](https://github.com/mastra-ai/mastra/commit/89200bafa05444bb7949b363ce7b743e29867561), [`3d6ae10`](https://github.com/mastra-ai/mastra/commit/3d6ae107c009a40cef08e83da6866c20783d7ac1), [`c950138`](https://github.com/mastra-ai/mastra/commit/c950138e72e4f317a40187e3800588731ab790ce), [`810c7e7`](https://github.com/mastra-ai/mastra/commit/810c7e74929989d8b8b5db52cd3af22cd0998af4), [`063c8b2`](https://github.com/mastra-ai/mastra/commit/063c8b2eb14e4e5ca021779bc33e8c3c031c8604), [`f9f9884`](https://github.com/mastra-ai/mastra/commit/f9f98848ee194dc71a787a709ec430b065cdc41b), [`e0904dc`](https://github.com/mastra-ai/mastra/commit/e0904dc538792e54e1806b70172e5900ac49bff4), [`9672fab`](https://github.com/mastra-ai/mastra/commit/9672fabfbcadb961a35c22a2d6722e077f7b24b9), [`f4e964c`](https://github.com/mastra-ai/mastra/commit/f4e964cad57057301d6bed5c55bcdd730175b941), [`1f7bbd7`](https://github.com/mastra-ai/mastra/commit/1f7bbd7785a8d230aad02454ecabeb4a0b2cc96f), [`e47ff36`](https://github.com/mastra-ai/mastra/commit/e47ff36945720f4ee4caa09f6e83514d7d188608), [`64d6781`](https://github.com/mastra-ai/mastra/commit/64d67814bccddd314f7e09643243821e57cb87b6), [`fb9a6ac`](https://github.com/mastra-ai/mastra/commit/fb9a6ac11c9560518742ece60b49d6b062845fd3), [`aa2cec8`](https://github.com/mastra-ai/mastra/commit/aa2cec8501f634d51c2f3ebfb3dd3aa7af8d2ca2), [`c848e65`](https://github.com/mastra-ai/mastra/commit/c848e655a64ff10331a8ceafafe7f18e70a0f092), [`2adf8eb`](https://github.com/mastra-ai/mastra/commit/2adf8eb4a70ed2b6cff2dd39281496ea0e025fac), [`0494489`](https://github.com/mastra-ai/mastra/commit/049448906e4c3d2d615bbe865b073a0d890ddb7c), [`8d1aeb8`](https://github.com/mastra-ai/mastra/commit/8d1aeb8acf7c20c4bb8e4d8e4bdc6569c83ac561), [`8264611`](https://github.com/mastra-ai/mastra/commit/8264611510e421b818bc7395dc2ae4d9c2d518b2), [`d8fa243`](https://github.com/mastra-ai/mastra/commit/d8fa2430d21113e330c4e676ac65e1235cf44f81), [`44fc98b`](https://github.com/mastra-ai/mastra/commit/44fc98b9d1242aa87a3ab44bdce9e9f12c44d8c9), [`f933ba3`](https://github.com/mastra-ai/mastra/commit/f933ba32700e1d0bf143311c1a08f88300b840b6), [`83065bf`](https://github.com/mastra-ai/mastra/commit/83065bfee9e47c3c6f09132a9034501f6cfb69cf), [`0f2ef41`](https://github.com/mastra-ai/mastra/commit/0f2ef4118da022e4f30dac4e9856cc3a8c97671c), [`01b162f`](https://github.com/mastra-ai/mastra/commit/01b162fe435295881aa7ea55f1759407ad5175ad)]:
  - @mastra/core@1.57.0
  - @mastra/observability@1.16.5

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
