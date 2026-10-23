import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import {
  expectRedeliveryParity,
  REDELIVERY_MODES,
  redeliverAndDrain,
} from '../../../workflows/evented/test-utils/redelivery-contract';
import { RedeliveryDriver } from '../../../workflows/evented/test-utils/redelivery-driver';
import { Agent } from '../../agent';
import { createEventedAgent } from '../create-evented-agent';

const rows = [
  { disposition: 'foreground', args: { topic: 'delivery' } },
  { disposition: 'deferred', args: { topic: 'delivery', _background: { disposition: 'deferred' } } },
  { disposition: 'awaited', args: { topic: 'delivery', _background: { disposition: 'awaited' } } },
] as const;

describe('T4 background-tools redelivery', () => {
  it.each(rows.flatMap(row => REDELIVERY_MODES.map(mode => ({ ...row, mode }))))(
    '$disposition / $mode replay preserves one completed tool execution',
    async ({ disposition, args, mode }) => {
      let modelCalls = 0;
      const emittedArgs: unknown[] = [];
      const chunkTypes: string[] = [];
      const model = new MockLanguageModelV2({
        doStream: async () => {
          modelCalls++;
          const parts =
            modelCalls === 1
              ? [
                  { type: 'stream-start', warnings: [] },
                  {
                    type: 'tool-call',
                    toolCallId: `${disposition}-1`,
                    toolName: 'research',
                    input: JSON.stringify(args),
                  },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                  },
                ]
              : [
                  { type: 'stream-start', warnings: [] },
                  { type: 'text-start', id: 'done' },
                  { type: 'text-delta', id: 'done', delta: 'done' },
                  { type: 'text-end', id: 'done' },
                  { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
                ];
          emittedArgs.push(modelCalls === 1 ? args : undefined);
          return {
            stream: convertArrayToReadableStream(parts),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
      }) as unknown as LanguageModelV2;

      const received: Array<{ topic: string }> = [];
      const research = createTool({
        id: 'research',
        description: 'Research a topic',
        inputSchema: z.object({ topic: z.string() }),
        background: { enabled: true },
        execute: async input => {
          received.push(input);
          return { summary: `Research on ${input.topic}` };
        },
      });
      const agent = createEventedAgent({
        agent: new Agent({
          id: `t4-${disposition}-agent`,
          name: `t4-${disposition}-agent`,
          instructions: 'Research the topic.',
          model,
          tools: { research },
          backgroundTasks: { tools: { research: true } },
        }),
      });
      const storage = new MockStore();
      const driver = new RedeliveryDriver();
      const mastra = new Mastra({
        logger: false,
        storage,
        pubsub: driver.pubsub,
        backgroundTasks: { enabled: true },
        agents: { [`t4-${disposition}-agent`]: agent },
      });
      let cleanup: (() => void) | undefined;

      try {
        await mastra.startWorkers();
        driver.assertEvented(agent.getWorkflow() as { engineType?: string });
        const stream = await agent.stream('Research delivery.', {
          maxSteps: 4,
          onChunk: chunk => chunkTypes.push(chunk.type),
        });
        cleanup = stream.cleanup;
        await stream.output.consumeStream();
        expect(await stream.output.text).toBe('done');
        expect(emittedArgs[0]).toEqual(args);
        await vi.waitFor(() => expect(received).toHaveLength(1));
        expect(received[0]).toEqual({ topic: 'delivery' });

        const original = driver.stepRuns({ spec: 'tool-step' }).at(-1)!;
        const workflowRunId = original.data?.runId as string;
        const match = { spec: 'tool-step', runId: workflowRunId };
        expect(original.data).toMatchObject({
          workflowId: 'durable-agentic-execution',
          runId: workflowRunId,
          executionPath: [3, 0],
          stepResults: {
            'extract-tool-calls': {
              output: [
                {
                  toolCallId: `${disposition}-1`,
                  toolName: 'research',
                  args,
                },
              ],
            },
          },
        });
        await redeliverAndDrain(driver, match, mode);
        expectRedeliveryParity(
          {
            received,
            emittedArgs,
            backgroundTaskNotifications: chunkTypes.filter(type => type === 'background-task-started').length,
            modelCalls,
          },
          {
            received: [{ topic: 'delivery' }],
            emittedArgs: [args, undefined],
            backgroundTaskNotifications: 1,
            modelCalls: 2,
          },
          mode === 'same-id' || disposition === 'awaited'
            ? undefined
            : {
                reason:
                  mode === 'expired'
                    ? 'COR-1307 / COR-1394: an expired completed foreground/deferred step dispatches the tool again.'
                    : 'COR-1307: a fresh-ID replay dispatches the completed foreground/deferred tool again.',
                expect: correct => ({ ...correct, received: [...correct.received, ...correct.received] }),
              },
        );
      } finally {
        cleanup?.();
        await mastra.stopWorkers();
        await mastra.backgroundTaskManager?.shutdown();
        const bgStore = await storage.getStore('backgroundTasks');
        await bgStore?.dangerouslyClearAll();
        driver.dispose();
        vi.useRealTimers();
      }
    },
    30_000,
  );
});
