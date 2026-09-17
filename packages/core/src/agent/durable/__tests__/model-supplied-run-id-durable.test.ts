import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage/mock';
import { createStep, createWorkflow } from '../../../workflows';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

async function drain(stream: AsyncIterable<unknown>) {
  for await (const _chunk of stream) {
    // Drain the durable run to completion.
  }
}

afterEach(() => {
  globalRunRegistry.clear();
});

describe('durable delegation with unverified model-supplied suspendedToolRunId', () => {
  it('starts a fresh sub-agent run instead of resuming an arbitrary model-authored id', async () => {
    let subAgentCalls = 0;
    const subAgent = new Agent({
      id: 'subAgent',
      name: 'Sub Agent',
      description: 'Does delegated work.',
      instructions: 'Do the work.',
      model: new MockLanguageModelV2({
        doStream: async () => {
          subAgentCalls += 1;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream<any>([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'sub-response', modelId: 'mock-model', timestamp: new Date(0) },
              { type: 'text-start', id: 'sub-text' },
              { type: 'text-delta', id: 'sub-text', delta: 'work done' },
              { type: 'text-end', id: 'sub-text' },
              { type: 'finish', finishReason: 'stop', usage },
            ]),
          };
        },
      }),
    });

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'Supervisor',
      instructions: 'Delegate the work.',
      agents: { subAgent },
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          const hasToolResult = JSON.stringify(prompt).includes('work done');
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream<any>(
              hasToolResult
                ? [
                    { type: 'stream-start', warnings: [] },
                    {
                      type: 'response-metadata',
                      id: 'final-response',
                      modelId: 'mock-model',
                      timestamp: new Date(0),
                    },
                    { type: 'text-start', id: 'final-text' },
                    { type: 'text-delta', id: 'final-text', delta: 'complete' },
                    { type: 'text-end', id: 'final-text' },
                    { type: 'finish', finishReason: 'stop', usage },
                  ]
                : [
                    { type: 'stream-start', warnings: [] },
                    {
                      type: 'response-metadata',
                      id: 'tool-response',
                      modelId: 'mock-model',
                      timestamp: new Date(0),
                    },
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'delegation-call',
                      toolName: 'agent-subAgent',
                      input: JSON.stringify({
                        prompt: 'do the work',
                        resumeData: { approved: true },
                        suspendedToolRunId: 'hallucinated-run-id',
                      }),
                      providerExecuted: false,
                    },
                    { type: 'finish', finishReason: 'tool-calls', usage },
                  ],
            ),
          };
        },
      }),
    });

    const pubsub = new EventEmitterPubSub();
    const durableAgent = createDurableAgent({ agent: supervisor, pubsub });
    new Mastra({ agents: { durableAgent }, storage: new InMemoryStore(), logger: false });

    try {
      const result = await durableAgent.stream('Do the work', { maxSteps: 3 });
      await drain(result.fullStream);
      expect(subAgentCalls).toBe(1);
    } finally {
      await pubsub.close();
    }
  });

  it('uses unique fresh workflow runs despite repeated model-authored resume identity', async () => {
    const completedTickets: string[] = [];
    const schema = z.object({ ticket: z.string() });
    const workflow = createWorkflow({
      id: 'ticket-workflow',
      inputSchema: schema,
      outputSchema: schema,
    })
      .then(
        createStep({
          id: 'ticket-step',
          inputSchema: schema,
          outputSchema: schema,
          execute: async ({ inputData }) => {
            completedTickets.push(inputData.ticket);
            return inputData;
          },
        }),
      )
      .commit();
    const createRunSpy = vi.spyOn(workflow, 'createRun');

    const agent = new Agent({
      id: 'workflow-supervisor',
      name: 'Workflow Supervisor',
      instructions: 'Run every ticket workflow.',
      workflows: { ticketWorkflow: workflow },
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          const hasToolResult = JSON.stringify(prompt).includes('tool-result');
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream<any>(
              hasToolResult
                ? [
                    { type: 'stream-start', warnings: [] },
                    {
                      type: 'response-metadata',
                      id: 'final-response',
                      modelId: 'mock-model',
                      timestamp: new Date(0),
                    },
                    { type: 'text-start', id: 'final-text' },
                    { type: 'text-delta', id: 'final-text', delta: 'complete' },
                    { type: 'text-end', id: 'final-text' },
                    { type: 'finish', finishReason: 'stop', usage },
                  ]
                : [
                    { type: 'stream-start', warnings: [] },
                    {
                      type: 'response-metadata',
                      id: 'tool-response',
                      modelId: 'mock-model',
                      timestamp: new Date(0),
                    },
                    ...['A', 'B'].map(ticket => ({
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: `ticket-${ticket}`,
                      toolName: 'workflow-ticketWorkflow',
                      input: JSON.stringify({
                        inputData: { ticket },
                        resumeData: { approved: true },
                        suspendedToolRunId: 'repeated-model-run-id',
                      }),
                      providerExecuted: false,
                    })),
                    { type: 'finish', finishReason: 'tool-calls', usage },
                  ],
            ),
          };
        },
      }),
    });

    const pubsub = new EventEmitterPubSub();
    const durableAgent = createDurableAgent({ agent, pubsub });
    new Mastra({ agents: { durableAgent }, workflows: { workflow }, storage: new InMemoryStore(), logger: false });

    try {
      const result = await durableAgent.stream('Run tickets A and B', { maxSteps: 3 });
      await drain(result.fullStream);

      expect(createRunSpy).toHaveBeenCalledTimes(2);
      const runIds = createRunSpy.mock.calls.map(call => call[0]?.runId);
      expect(runIds[0]).toBeTruthy();
      expect(runIds[1]).toBeTruthy();
      expect(runIds[0]).not.toBe(runIds[1]);
      expect(runIds).not.toContain('repeated-model-run-id');
      expect(completedTickets.sort()).toEqual(['A', 'B']);
    } finally {
      await pubsub.close();
    }
  });
});
