import { Agent } from '@mastra/core/agent';
import type { LanguageModel } from '@mastra/core/llm';
import { createTool } from '@mastra/core/tools';
import { convertArrayToReadableStream } from 'ai/test';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createInngestAgent } from '../durable-agent';
import {
  generateTestId,
  getSharedInngest,
  getSharedMastra,
  setupSharedTestInfrastructure,
  teardownSharedTestInfrastructure,
} from './durable-agent.test.utils';

type TestModel = Extract<LanguageModel, { specificationVersion: 'v2' }>;

function createModel(modelId: string, doStream: TestModel['doStream']): TestModel {
  return {
    specificationVersion: 'v2',
    provider: 'test',
    modelId,
    supportedUrls: {},
    doGenerate: async () => {
      throw new Error('Expected streaming model invocation');
    },
    doStream,
  };
}

describe('Inngest model fallback (#26146)', () => {
  beforeAll(setupSharedTestInfrastructure);
  afterAll(teardownSharedTestInfrastructure);

  it.each([
    { name: 'on the first iteration', withToolCall: false },
    { name: 'again after a tool call', withToolCall: true },
  ])('uses the fallback model $name', async ({ withToolCall }) => {
    const primaryStream = vi.fn<TestModel['doStream']>().mockRejectedValue(new Error('Primary unavailable'));
    const fallbackStream = vi.fn<TestModel['doStream']>().mockImplementation(async () => {
      const callTool = withToolCall && fallbackStream.mock.calls.length === 1;
      return {
        stream: callTool
          ? convertArrayToReadableStream([
              { type: 'tool-call', toolCallId: 'call-note', toolName: 'get_note', input: '{}' },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ])
          : convertArrayToReadableStream([
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Fallback answered.' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ]),
        warnings: [],
      };
    });
    const execute = vi.fn(async () => ({ note: 'Saved.' }));
    const agent = new Agent({
      id: `model-fallback-${generateTestId()}`,
      name: 'Model Fallback',
      instructions: 'Read the note and answer.',
      model: [
        { id: 'primary', model: createModel('primary', primaryStream), maxRetries: 0 },
        {
          id: 'fallback',
          model: createModel('fallback', fallbackStream),
          maxRetries: 0,
        },
      ],
      tools: {
        get_note: createTool({
          id: 'get_note',
          description: 'Read a note.',
          inputSchema: z.object({}),
          outputSchema: z.object({ note: z.string() }),
          execute,
        }),
      },
    });
    const durableAgent = createInngestAgent({ agent, inngest: getSharedInngest() });
    getSharedMastra().addAgent(durableAgent);

    const result = await durableAgent.generate('Read the note.', { maxSteps: 3 });

    expect(result.text).toBe('Fallback answered.');
    expect(primaryStream).toHaveBeenCalledTimes(withToolCall ? 2 : 1);
    expect(fallbackStream).toHaveBeenCalledTimes(withToolCall ? 2 : 1);
    expect(execute).toHaveBeenCalledTimes(withToolCall ? 1 : 0);
  });
});
