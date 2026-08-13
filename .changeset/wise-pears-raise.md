---
'@mastra/core': patch
---

Fixed missing TypeScript declarations for the `@mastra/core/test-utils/llm-mock` entrypoint. `MastraLanguageModelV2Mock`, `createMockModel`, and `simulateReadableStream` are now fully typed when imported in consumer projects — no need for a local ambient `declare module` shim.

```ts
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';

const mockModel = new MastraLanguageModelV2Mock({
  doGenerate: async () => ({
    content: [{ type: 'text', text: 'stubbed response' }],
    finishReason: 'stop',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    warnings: [],
  }),
});

// Spy arrays are typed as LanguageModelV2CallOptions[]
mockModel.doGenerateCalls;
```
