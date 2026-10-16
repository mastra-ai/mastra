import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { ChunkType } from '../../stream/types';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';

afterEach(() => agentThreadStreamRuntime.resetForTests());

describe('client-tool continuations with the default in-process transport', () => {
  it('delivers the final model response after the completed source run leaves memory', async () => {
    const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
    const clientTools = {
      configure: createTool({
        id: 'configure',
        description: 'Configure the agent in the browser',
        inputSchema: z.object({ name: z.string() }),
      }),
    };
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        const continued = JSON.stringify(prompt).includes('"type":"tool-result"');
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            ...(continued
              ? [
                  { type: 'text-start' as const, id: 'done' },
                  { type: 'text-delta' as const, id: 'done', delta: 'Configuration complete.' },
                  { type: 'text-end' as const, id: 'done' },
                  { type: 'finish' as const, finishReason: 'stop' as const, usage },
                ]
              : [
                  {
                    type: 'tool-call' as const,
                    toolCallId: 'configure-1',
                    toolName: 'configure',
                    input: '{"name":"Support Agent"}',
                  },
                  { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
                ]),
          ]),
        };
      },
    });
    const pubsub = new EventEmitterPubSub();
    const agent = new Agent({ id: 'builder', name: 'Builder', instructions: 'Configure an agent.', model, pubsub });
    const identity = { resourceId: 'browser-user', threadId: 'builder-thread' };
    const subscription = await agent.subscribeToThread(identity);
    const chunks: ChunkType[] = [];
    const consuming = (async () => {
      for await (const chunk of subscription.stream) chunks.push(chunk);
    })();
    try {
      const source = await agent.sendMessage('Configure support.', {
        ...identity,
        ifIdle: { streamOptions: { clientTools } },
      }).accepted;
      if (source.action !== 'wake') throw new Error('Expected the builder to start a source run');
      await source.output.consumeStream();
      await vi.waitFor(() => expect(agentThreadStreamRuntime.hasThreadRun(source.runId, pubsub)).toBe(false));
      expect(chunks.some(chunk => chunk.type === 'tool-call')).toBe(true);

      const continuation = await agent.sendToolApproval({
        ...identity,
        sourceRunId: source.runId,
        approved: true,
        streamOptions: { clientTools },
        messages: [
          {
            role: 'assistant',
            content: [
              { type: 'tool-call', toolCallId: 'configure-1', toolName: 'configure', input: { name: 'Support Agent' } },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'configure-1',
                toolName: 'configure',
                output: { type: 'json', value: { success: true } },
              },
            ],
          },
        ],
      });
      await vi.waitFor(() => {
        expect(
          chunks.some(
            chunk =>
              chunk.type === 'text-delta' &&
              chunk.runId === continuation.runId &&
              chunk.payload.text === 'Configuration complete.',
          ),
        ).toBe(true);
      });
    } finally {
      subscription.unsubscribe();
      await consuming;
    }
  });
});
