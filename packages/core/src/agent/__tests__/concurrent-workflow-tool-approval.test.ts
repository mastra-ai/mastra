import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createStep, createWorkflow } from '../../workflows';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function createConcurrentWorkflowModel() {
  return new MockLanguageModelV2({
    doStream: async options => {
      const hasToolResult = JSON.stringify(options.prompt).includes('"type":"tool-result"');
      const parts = hasToolResult
        ? [
            { type: 'stream-start' as const, warnings: [] },
            {
              type: 'response-metadata' as const,
              id: 'final-response',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start' as const, id: 'final-text' },
            { type: 'text-delta' as const, id: 'final-text', delta: 'Both workflows completed.' },
            { type: 'text-end' as const, id: 'final-text' },
            { type: 'finish' as const, finishReason: 'stop' as const, usage },
          ]
        : [
            { type: 'stream-start' as const, warnings: [] },
            {
              type: 'response-metadata' as const,
              id: 'tool-call-response',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            {
              type: 'tool-call' as const,
              toolCallId: 'call-workflow-a',
              toolName: 'workflow-workflowA',
              input: JSON.stringify({
                inputData: { ticket: 'A' },
                suspendedToolRunId: null,
                resumeData: null,
              }),
            },
            {
              type: 'tool-call' as const,
              toolCallId: 'call-workflow-b',
              toolName: 'workflow-workflowB',
              input: JSON.stringify({
                inputData: { ticket: 'B' },
                suspendedToolRunId: null,
                resumeData: null,
              }),
            },
            { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
          ];

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(parts),
      };
    },
  });
}

function createSuspendingWorkflow(id: string) {
  const schema = z.object({ ticket: z.string() });
  const step = createStep({
    id: `${id}-step`,
    inputSchema: schema,
    outputSchema: z.object({ ticket: z.string(), completed: z.boolean() }),
    suspendSchema: z.object({ ticket: z.string() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async ({ inputData, resumeData, suspend }) => {
      if (!resumeData) {
        return suspend({ ticket: inputData.ticket });
      }

      return { ticket: inputData.ticket, completed: resumeData.approved };
    },
  });

  return createWorkflow({
    id,
    inputSchema: schema,
    outputSchema: z.object({ ticket: z.string(), completed: z.boolean() }),
  })
    .then(step)
    .commit();
}

afterEach(() => {
  agentThreadStreamRuntime.resetForTests();
});

describe('concurrent workflow tool approvals', () => {
  it.each(['forward', 'reverse', 'concurrent'] as const)(
    'resumes every suspended workflow in %s order',
    async order => {
      const workflowA = createSuspendingWorkflow('workflow-a');
      const workflowB = createSuspendingWorkflow('workflow-b');
      const agent = new Agent({
        id: 'concurrent-workflow-agent',
        name: 'Concurrent Workflow Agent',
        instructions: 'Run both workflows.',
        model: createConcurrentWorkflowModel(),
        memory: new MockMemory(),
        workflows: { workflowA, workflowB },
      });
      const mastra = new Mastra({
        agents: { agent },
        workflows: { workflowA, workflowB },
        storage: new InMemoryStore(),
        logger: false,
      });
      const registeredAgent = mastra.getAgent('agent');
      const threadId = `concurrent-workflow-${order}`;
      const resourceId = 'concurrent-workflow-user';
      const chunks: any[] = [];
      const subscription = await registeredAgent.subscribeToThread({ threadId, resourceId });
      const consumeSubscription = (async () => {
        for await (const chunk of subscription.stream) {
          chunks.push(chunk);
        }
      })();

      try {
        await registeredAgent.stream('Run workflow A and workflow B together.', {
          maxSteps: 6,
          memory: { thread: threadId, resource: resourceId },
        });

        await vi.waitFor(
          () => {
            expect(chunks.filter(chunk => chunk.type === 'tool-call-suspended')).toHaveLength(2);
          },
          { timeout: 10_000 },
        );

        const suspendedIds = chunks
          .filter(chunk => chunk.type === 'tool-call-suspended')
          .map(chunk => chunk.payload.toolCallId as string);

        const orderedIds = order === 'reverse' ? [...suspendedIds].reverse() : suspendedIds;
        const approve = (toolCallId: string) =>
          registeredAgent.sendToolApproval({
            threadId,
            resourceId,
            toolCallId,
            approved: true,
            resumeData: { approved: true },
          });

        if (order === 'concurrent') {
          await Promise.all(orderedIds.map(approve));
        } else {
          for (const toolCallId of orderedIds) {
            await approve(toolCallId);
          }
        }

        await vi.waitFor(
          () => {
            const successfulToolCallIds = new Set(
              chunks.filter(chunk => chunk.type === 'tool-result').map(chunk => chunk.payload.toolCallId as string),
            );
            expect(successfulToolCallIds).toEqual(new Set(['call-workflow-a', 'call-workflow-b']));
            expect(chunks.filter(chunk => chunk.type === 'tool-error' || chunk.type === 'error')).toEqual([]);
            expect(
              chunks
                .filter(chunk => chunk.type === 'text-delta')
                .map(chunk => chunk.payload.text)
                .join(''),
            ).toContain('Both workflows completed.');
            expect(chunks.some(chunk => chunk.type === 'finish' && chunk.payload.stepResult?.reason === 'stop')).toBe(
              true,
            );
          },
          { timeout: 10_000 },
        );
      } finally {
        subscription.unsubscribe();
        await consumeSubscription;
      }
    },
    30_000,
  );
});
