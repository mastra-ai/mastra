import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';

import { Agent } from '../../agent';

const runId = 'unconsumed-threadless-run';
const agent = new Agent({
  id: 'unconsumed-threadless-agent',
  name: 'Unconsumed threadless cleanup test',
  instructions: 'Test',
  model: new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        {
          type: 'response-metadata',
          id: 'unconsumed-response',
          modelId: 'mock-model-id',
          timestamp: new Date(0),
        },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 0, totalTokens: 1 } },
      ]),
    }),
  }),
});

const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
if (!gc) throw new Error('GC is not exposed');

let output: Awaited<ReturnType<typeof agent.stream>> | undefined = await agent.stream('hello', { runId });
let outputCollected = false;
const outputFinalizer = new FinalizationRegistry(() => {
  outputCollected = true;
});
outputFinalizer.register(output, undefined);
output = undefined;

for (let attempt = 0; attempt < 100 && !outputCollected; attempt++) {
  gc();
  await new Promise<void>(resolve => setImmediate(resolve));
}

if (!outputCollected) throw new Error('Stream output was not garbage collected');

for (let attempt = 0; attempt < 10; attempt++) {
  gc();
  await new Promise<void>(resolve => setImmediate(resolve));
}

if (agent.abortRunStream(runId)) throw new Error('Prepared run was retained after its output was collected');
process.send?.('ok');
