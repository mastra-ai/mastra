import { Agent } from '@mastra/core/agent';
import { MockMemory } from '@mastra/core/memory';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

let resolveToolStarted: () => void = () => {};
// Resolves once the agent's tool is executing, so the route can return while the run is still in flight.
export const shutdownThreadToolStarted = new Promise<void>(resolve => (resolveToolStarted = resolve));

// Keeps running until the run is aborted. Only `mastra.shutdown()` handing the thread run back aborts it.
const waitForAbortTool = createTool({
  id: 'wait-for-abort',
  description: 'Waits until the run is aborted.',
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    console.log('shutdown-thread-run:tool-started');
    resolveToolStarted();
    const signal = context?.abortSignal;
    if (signal && !signal.aborted) await new Promise(resolve => signal.addEventListener('abort', resolve));
    console.log(signal?.aborted ? 'shutdown-thread-run:aborted' : 'shutdown-thread-run:no-signal');
    return 'done';
  },
});

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

const toolCallingModel = {
  specificationVersion: 'v2' as const,
  provider: 'e2e-provider',
  modelId: 'e2e-shutdown-thread-model',
  supportedUrls: {},
  async doGenerate(): Promise<never> {
    throw new Error('not used');
  },
  async doStream() {
    const chunks = [
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id: 'e2e-shutdown', modelId: 'e2e-shutdown-thread-model', timestamp: new Date() },
      { type: 'tool-call', toolCallId: 'call_wait', toolName: 'waitForAbort', input: '{}' },
      { type: 'finish', finishReason: 'tool-calls', usage },
    ];
    return {
      stream: new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      }),
    };
  },
};

export const shutdownThreadAgent = new Agent({
  id: 'shutdown-thread-agent',
  name: 'Shutdown Thread Agent',
  instructions: 'Call the wait-for-abort tool.',
  model: toolCallingModel,
  memory: new MockMemory(),
  tools: { waitForAbort: waitForAbortTool },
});
