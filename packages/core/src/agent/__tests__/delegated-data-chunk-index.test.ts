/**
 * A durable sub-agent's chunks carry its own run-log `index`. When its `data-*`
 * chunks bubble up to a plain parent's stream, that index must not come along:
 * it isn't a position in the parent's run log, so a client can't resume from it.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable/create-durable-agent';
import { globalRunRegistry } from '../durable/run-registry';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function makeModel(toolName: string, input: string, doneMarker: string, answer: string) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream<any>(
        JSON.stringify(prompt).includes(doneMarker)
          ? [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: answer },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: 'stop', usage },
            ]
          : [
              { type: 'stream-start', warnings: [] },
              { type: 'tool-call', toolCallType: 'function', toolCallId: `${toolName}-1`, toolName, input },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ],
      ),
    }),
  });
}

describe('data chunks bubbled from a durable sub-agent', () => {
  const pubsub = new EventEmitterPubSub();

  afterEach(async () => {
    globalRunRegistry.clear();
  });

  it('reach the parent stream without the sub-agent index', async () => {
    const progress = createTool({
      id: 'progress',
      description: 'Report progress',
      inputSchema: z.object({}),
      execute: async (_input, context: any) => {
        await context?.writer?.custom({ type: 'data-progress', data: { step: 1 } });
        return { reported: true };
      },
    });
    const subAgent = createDurableAgent({
      agent: new Agent({
        id: 'subAgent',
        name: 'subAgent',
        description: 'Reports progress',
        instructions: 'Report progress.',
        model: makeModel('progress', '{}', '"reported":true', 'Reported.') as LanguageModelV2,
        tools: { progress },
      }),
      pubsub,
    });
    const parent = new Agent({
      id: 'parent',
      name: 'parent',
      instructions: 'Delegate to subAgent.',
      model: makeModel('agent-subAgent', JSON.stringify({ prompt: 'go' }), 'Reported.', 'Done.') as LanguageModelV2,
      agents: { subAgent: subAgent as any },
    });

    const output = await parent.stream('go', { maxSteps: 3 });
    const dataChunks: any[] = [];
    for await (const chunk of output.fullStream) {
      if (chunk.type.startsWith('data-')) dataChunks.push(chunk);
    }

    expect(dataChunks.map(c => c.type)).toContain('data-progress');
    for (const chunk of dataChunks) expect(chunk).not.toHaveProperty('index');
  }, 30_000);
});
