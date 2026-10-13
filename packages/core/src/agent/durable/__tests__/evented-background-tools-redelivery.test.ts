import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { RedeliveryDriver } from '../../../workflows/evented/test-utils/redelivery-driver';
import { Agent } from '../../agent';
import { createEventedAgent } from '../create-evented-agent';

const rows = [
  { disposition: 'foreground', args: { topic: 'delivery' } },
  { disposition: 'deferred', args: { topic: 'delivery', _background: { disposition: 'deferred' } } },
  { disposition: 'awaited', args: { topic: 'delivery', _background: { disposition: 'awaited' } } },
] as const;

describe('T4 background-tools redelivery', () => {
  it.each(rows)(
    '$disposition: wf-evented-redeliver pins the completed tool-step replay',
    async ({ disposition, args }) => {
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
        const deliveriesBefore = driver.deliveryCount(match);
        const { event, handled } = await driver.redeliver(match, { viaPublish: true });
        expect(event.id).not.toBe(original.id);
        expect(event.deliveryAttempt).toBe(1);
        expect(handled).toHaveLength(1);
        expect(handled[0]?.result.ok).toBe(true);
        expect(driver.deliveryCount(match)).toBe(deliveriesBefore + 1);

        // COR-1307: foreground/deferred fresh-id replay dispatches the completed tool again;
        // awaited currently preserves its single execution while still consuming the duplicate.
        const expectedExecutions = disposition === 'awaited' ? 1 : 2;
        await vi.waitFor(() => expect(received).toHaveLength(expectedExecutions));
        expect(received).toEqual(Array.from({ length: expectedExecutions }, () => ({ topic: 'delivery' })));
        expect(chunkTypes.filter(type => type === 'background-task-started')).toHaveLength(1);
        expect(modelCalls).toBe(2);
      } finally {
        cleanup?.();
        await mastra.stopWorkers();
        await mastra.backgroundTaskManager?.shutdown();
        const bgStore = await storage.getStore('backgroundTasks');
        await bgStore?.dangerouslyClearAll();
        driver.dispose();
      }
    },
    30_000,
  );
});
