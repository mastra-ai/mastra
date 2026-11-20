import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Processor } from '../../processors';
import { createTool } from '../../tools';
import { Agent } from '../agent';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

/** Calls a tool on its first step, then answers, so one run makes two model calls. */
function makeToolCallingModel() {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      return {
        stream: convertArrayToReadableStream(
          calls === 1
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{}' },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 'text' },
                { type: 'text-delta', id: 'text', delta: 'ok' },
                { type: 'text-end', id: 'text' },
                { type: 'finish', finishReason: 'stop', usage },
              ],
        ),
      };
    },
  });
}

const lookupTool = createTool({
  id: 'lookup',
  description: 'Look something up',
  inputSchema: z.object({}),
  execute: async () => ({ found: true }),
});

/** Aborts in processInputStep once a tool-call step has already finished. */
const abortBetweenSteps: Processor = {
  id: 'between-steps-guard',
  processInputStep: async ({ stepNumber, abort }) => {
    if (stepNumber >= 1) abort('storage locked');
    return {};
  },
};

describe('processInputStep tripwire after a finished tool-call step', () => {
  it('settles the stream output instead of leaving it running', async () => {
    const agent = new Agent({
      id: 'tripwire-agent',
      name: 'tripwire-agent',
      instructions: 'test',
      model: makeToolCallingModel(),
      tools: { lookup: lookupTool },
      inputProcessors: [abortBetweenSteps],
    });

    const output = await agent.stream('hi');
    const chunks: { type: string; payload?: any }[] = [];
    for await (const chunk of output.fullStream) chunks.push(chunk as any);

    const types = chunks.map(c => c.type);
    expect(types).toContain('tool-result');
    expect(types.at(-1)).toBe('tripwire');
    expect(chunks.at(-1)?.payload).toMatchObject({ reason: 'storage locked', processorId: 'between-steps-guard' });

    expect(output.status).toBe('tripwire');
    expect(output.tripwire).toMatchObject({ reason: 'storage locked', processorId: 'between-steps-guard' });
    await expect(output.finishReason).resolves.toBe('other');
    const full = await output.getFullOutput();
    expect(full.tripwire?.reason).toBe('storage locked');
  });
});
