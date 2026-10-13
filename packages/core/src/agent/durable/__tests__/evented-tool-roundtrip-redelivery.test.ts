import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { RedeliveryDriver } from '../../../workflows/evented/test-utils/redelivery-driver';
import { Agent } from '../../agent';
import { createEventedAgent } from '../create-evented-agent';

function toolCall(toolCallId: string, toolName: string, input: unknown) {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'tool-call', toolCallId, toolName, input: JSON.stringify(input) },
    { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
  ];
}

function finalText() {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: 'final' },
    { type: 'text-delta', id: 'final', delta: 'verified comparison value 42' },
    { type: 'text-end', id: 'final' },
    { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
  ];
}

describe('T1 tool-roundtrip redelivery', () => {
  it('wf-evented-redeliver: pins the harness fresh-id replay after the read tool completes', async () => {
    let modelCalls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        modelCalls++;
        const parts =
          modelCalls === 1
            ? toolCall('write-1', 'writeRecord', { name: 'comparison', amount: 42 })
            : modelCalls === 2
              ? toolCall('read-1', 'readRecord', { name: 'comparison', receipt: 'receipt-1' })
              : finalText();
        return {
          stream: convertArrayToReadableStream(parts as any[]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    }) as unknown as LanguageModelV2;

    const writes: Array<{ name: string; amount: number }> = [];
    const reads: Array<{ name: string; receipt: string }> = [];
    const readResults: Array<{ name: string; amount: number; verified: true }> = [];
    const writeRecord = createTool({
      id: 'writeRecord',
      description: 'Write a record',
      inputSchema: z.object({ name: z.string(), amount: z.number() }),
      execute: async input => {
        writes.push(input);
        return { receipt: `receipt-${writes.length}` };
      },
    });
    const readRecord = createTool({
      id: 'readRecord',
      description: 'Read a record',
      inputSchema: z.object({ name: z.string(), receipt: z.string() }),
      execute: async input => {
        reads.push(input);
        expect(input.receipt).toBe('receipt-1');
        const result = { ...writes[0]!, verified: true as const };
        readResults.push(result);
        return result;
      },
    });
    const agent = createEventedAgent({
      agent: new Agent({
        id: 't1-redelivery-agent',
        name: 't1-redelivery-agent',
        instructions: 'Write then read the record.',
        model,
        tools: { writeRecord, readRecord },
      }),
    });
    const driver = new RedeliveryDriver();
    const mastra = new Mastra({
      logger: false,
      storage: new InMemoryStore(),
      pubsub: driver.pubsub,
      agents: { 't1-redelivery-agent': agent },
    });

    try {
      await mastra.startWorkers();
      driver.assertEvented(agent.getWorkflow() as { engineType?: string });
      const { output, cleanup } = await agent.stream('Run the comparison.', { maxSteps: 6 });
      try {
        await output.consumeStream();
        expect(await output.text).toBe('verified comparison value 42');

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
                  toolCallId: 'read-1',
                  toolName: 'readRecord',
                  args: { name: 'comparison', receipt: 'receipt-1' },
                },
              ],
            },
          },
        });
        expect(writes).toEqual([{ name: 'comparison', amount: 42 }]);
        expect(reads).toEqual([{ name: 'comparison', receipt: 'receipt-1' }]);
        expect(readResults).toEqual([{ name: 'comparison', amount: 42, verified: true }]);
        expect(modelCalls).toBe(3);

        const deliveriesBefore = driver.deliveryCount(match);
        const { event, handled } = await driver.redeliver(match, { viaPublish: true });
        expect(event.id).not.toBe(original.id);
        expect(event.deliveryAttempt).toBe(1);
        expect(handled).toHaveLength(1);
        expect(handled[0]?.result.ok).toBe(true);
        expect(driver.deliveryCount(match)).toBe(deliveriesBefore + 1);

        // COR-1307: the harness's fresh-id replay re-executes the completed read tool step.
        await vi.waitFor(() => expect(reads).toHaveLength(2));
        expect(reads).toEqual([
          { name: 'comparison', receipt: 'receipt-1' },
          { name: 'comparison', receipt: 'receipt-1' },
        ]);
        expect(readResults).toEqual([
          { name: 'comparison', amount: 42, verified: true },
          { name: 'comparison', amount: 42, verified: true },
        ]);
        expect(writes).toEqual([{ name: 'comparison', amount: 42 }]);
        expect(modelCalls).toBe(3);
      } finally {
        cleanup();
      }
    } finally {
      await mastra.stopWorkers();
      driver.dispose();
    }
  }, 30_000);
});
