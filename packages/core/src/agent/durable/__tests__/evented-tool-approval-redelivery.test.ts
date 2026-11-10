import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import {
  expectRedeliveryParity,
  REDELIVERY_MODES,
  redeliverAndDrain,
} from '../../../workflows/evented/test-utils/redelivery-contract';
import { RedeliveryDriver } from '../../../workflows/evented/test-utils/redelivery-driver';
import { Agent } from '../../agent';
import { createEventedAgent } from '../create-evented-agent';

describe('T6 tool-approval redelivery', () => {
  it.each(REDELIVERY_MODES)(
    '%s replay preserves one approved execution and one approval request',
    async mode => {
      let modelCalls = 0;
      const model = new MockLanguageModelV2({
        doStream: async () => {
          modelCalls++;
          const parts =
            modelCalls === 1
              ? [
                  { type: 'stream-start', warnings: [] },
                  {
                    type: 'tool-call',
                    toolCallId: 'approve-1',
                    toolName: 'sendEmail',
                    input: JSON.stringify({ to: 'alice@example.com' }),
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
                  { type: 'text-delta', id: 'done', delta: 'sent' },
                  { type: 'text-end', id: 'done' },
                  { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
                ];
          return {
            stream: convertArrayToReadableStream(parts),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
      }) as unknown as LanguageModelV2;

      let executions = 0;
      const sendEmail = createTool({
        id: 'sendEmail',
        description: 'Send an email',
        inputSchema: z.object({ to: z.string() }),
        requireApproval: true,
        execute: async input => {
          executions++;
          return { sent: true, to: input.to };
        },
      });
      const agent = createEventedAgent({
        agent: new Agent({
          id: 't6-redelivery-agent',
          name: 't6-redelivery-agent',
          instructions: 'Send the email.',
          model,
          tools: { sendEmail },
        }),
      });
      const driver = new RedeliveryDriver();
      const mastra = new Mastra({
        logger: false,
        storage: new InMemoryStore(),
        pubsub: driver.pubsub,
        agents: { 't6-redelivery-agent': agent },
      });

      let initialCleanup: (() => void) | undefined;
      let resumedCleanup: (() => void) | undefined;
      try {
        await mastra.startWorkers();
        driver.assertEvented(agent.getWorkflow() as { engineType?: string });
        const initial = await agent.stream('Send it.', { maxSteps: 4 });
        initialCleanup = initial.cleanup;
        let approvalRequests = 0;
        let approvalPayload: unknown;
        for await (const chunk of initial.fullStream) {
          if (chunk.type === 'tool-call-approval') {
            approvalRequests++;
            approvalPayload = chunk.payload;
            break;
          }
        }
        expect(approvalRequests).toBe(1);
        expect(approvalPayload).toMatchObject({
          toolCallId: 'approve-1',
          toolName: 'sendEmail',
          args: { to: 'alice@example.com' },
        });
        expect(executions).toBe(0);

        const resumed = await agent.approveToolCall({ runId: initial.runId });
        resumedCleanup = resumed.cleanup;
        for await (const chunk of resumed.fullStream) {
          if (chunk.type === 'tool-call-approval') approvalRequests++;
        }
        expect(await resumed.text).toBe('sent');
        expect(approvalRequests).toBe(1);
        expect(executions).toBe(1);
        expect(modelCalls).toBe(2);

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
                  toolCallId: 'approve-1',
                  toolName: 'sendEmail',
                  args: { to: 'alice@example.com' },
                },
              ],
            },
          },
        });
        await redeliverAndDrain(driver, match, mode);
        expectRedeliveryParity(
          { executions, approvalRequests, modelCalls },
          { executions: 1, approvalRequests: 1, modelCalls: 2 },
          mode === 'same-id'
            ? undefined
            : {
                reason:
                  mode === 'expired'
                    ? 'COR-1307 / COR-1394: an expired completed approved step executes again.'
                    : 'COR-1307: a fresh-ID replay executes the completed approved step again.',
                expect: correct => ({ ...correct, executions: correct.executions + 1 }),
              },
        );
      } finally {
        initialCleanup?.();
        resumedCleanup?.();
        await mastra.stopWorkers();
        driver.dispose();
        vi.useRealTimers();
      }
    },
    30_000,
  );
});
