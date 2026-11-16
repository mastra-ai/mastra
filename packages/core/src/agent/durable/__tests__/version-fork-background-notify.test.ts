import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory';
import { MockStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

/**
 * A stored version of a durable agent runs on a fork (`__fork()`, as the editor and
 * `Mastra.resolveVersionedAgent` produce it). The `untilIdle` stream that waits for its
 * deferred tasks is opened on the fork, while the task's finish is reported through the
 * registered agent. Both must see the same `untilIdle` registry, or the registered agent
 * also sends the thread a `background-task` signal and the task is reported twice. (#29032)
 */
describe('a deferred task finished under a durable version fork', () => {
  let mastra: Mastra | undefined;

  afterEach(async () => {
    await mastra?.backgroundTaskManager?.shutdown();
  });

  // Turn 1 calls the tool; every later turn answers, so the run goes idle.
  function model() {
    let call = 0;
    return new MockLanguageModelV2({
      doStream: async () => {
        call++;
        const parts: any[] =
          call === 1
            ? [
                { type: 'tool-call', toolCallId: 'call-1', toolName: 'research', input: '{"topic":"otters"}' },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ]
            : [
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
              ];
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `s${call}`, modelId: 'mock', timestamp: new Date(0) },
            ...parts,
          ]),
        };
      },
    });
  }

  it('leaves the report to the untilIdle stream instead of also signalling the thread', async () => {
    const durableAgent = createDurableAgent({
      agent: new Agent({
        id: 'versioned-durable-bg-agent',
        name: 'versioned-durable-bg-agent',
        instructions: 'Use the research tool.',
        model: model(),
        tools: {
          research: createTool({
            id: 'research',
            description: 'Research a topic.',
            inputSchema: z.object({ topic: z.string() }),
            execute: async ({ topic }) => {
              await new Promise(resolve => setTimeout(resolve, 50));
              return { summary: `Research on ${topic}` };
            },
            background: { enabled: true },
          }),
        },
        memory: new MockMemory(),
      }),
    });
    mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { durableAgent },
      backgroundTasks: { enabled: true },
    });
    const registered = mastra.getAgent('durableAgent') as unknown as Agent;

    const signalled: unknown[] = [];
    const recordSignals = (target: Agent) =>
      vi.spyOn(target, 'sendSignal').mockImplementation(((signal: unknown) => {
        signalled.push(signal);
        return { accepted: Promise.resolve({ action: 'discard' }), signal };
      }) as any);
    recordSignals(registered);
    // What `Mastra.resolveVersionedAgent` hands a request for a stored version.
    const fork = registered.__fork();
    fork.__markStoredVersionApplied();
    recordSignals(fork);

    const result = await fork.streamUntilIdle('Research otters.', {
      memory: { thread: 'thread-durable-version-bg', resource: 'user-1' },
      maxSteps: 5,
    });
    const chunks: any[] = [];
    for await (const chunk of result.fullStream as AsyncIterable<any>) chunks.push(chunk);

    expect(chunks.some(c => c.type === 'background-task-completed')).toBe(true);
    // The notification is sent from the task's completion hook, before the stream sees the completion.
    expect(signalled).toEqual([]);
  });
});
