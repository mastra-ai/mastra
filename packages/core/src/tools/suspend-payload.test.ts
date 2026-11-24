import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '../agent/__tests__/mock-model';
import { createDurableAgent } from '../agent/durable/create-durable-agent';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
import { createWorkflow } from '../workflows/create';
import { createStep } from '../workflows/workflow';
import { createTool } from './tool';

/**
 * A resumed tool receives the payload it suspended with (`suspendPayload`)
 * next to the answer for that round (`resumeData`). One `createTool`
 * definition uses both under an agent and under a workflow.
 */
function createConfirmTool(seen: Array<{ suspendPayload: unknown; resumeData: unknown }>) {
  return createTool({
    id: 'confirmTool',
    description: 'Asks for confirmation before charging',
    inputSchema: z.object({ amount: z.number() }),
    outputSchema: z.object({ charged: z.number() }),
    suspendSchema: z.object({ phase: z.literal('confirm'), amount: z.number() }),
    resumeSchema: z.object({ confirmed: z.boolean() }),
    execute: async ({ amount }, context) => {
      const host = context.agent ?? context.workflow;
      if (!host) throw new Error('expected an agent or workflow host');
      if (!host.resumeData) {
        await host.suspend({ phase: 'confirm', amount });
        return;
      }
      seen.push({ suspendPayload: host.suspendPayload, resumeData: host.resumeData });
      if (!host.resumeData.confirmed) throw new Error('declined');
      return { charged: host.suspendPayload?.amount ?? -1 };
    },
  });
}

function createModel() {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'confirmTool',
              input: '{"amount":990}',
              providerExecuted: false,
            },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-2', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: 'Charged' },
          { type: 'text-end', id: 't' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      };
    },
  });
}

describe('suspendPayload on resume', () => {
  it('is handed back to a tool resumed by an agent', async () => {
    const seen: Array<{ suspendPayload: unknown; resumeData: unknown }> = [];
    const agent = new Agent({
      id: 'confirm-agent',
      name: 'Confirm Agent',
      instructions: 'Charge after confirmation.',
      model: createModel(),
      tools: { confirmTool: createConfirmTool(seen) },
    });
    new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });

    const stream = await agent.stream('Charge 990');
    let suspended: { toolCallId: string; suspendPayload: unknown } | undefined;
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-suspended') {
        suspended = { toolCallId: chunk.payload.toolCallId, suspendPayload: chunk.payload.suspendPayload };
      }
    }
    expect(suspended).toEqual({ toolCallId: 'call-1', suspendPayload: { phase: 'confirm', amount: 990 } });

    const resumed = await agent.resumeStream(
      { confirmed: true },
      { runId: stream.runId, toolCallId: suspended!.toolCallId },
    );
    let result: unknown;
    for await (const chunk of resumed.fullStream) {
      if (chunk.type === 'tool-result') result = chunk.payload.result;
    }
    expect(seen).toEqual([{ suspendPayload: { phase: 'confirm', amount: 990 }, resumeData: { confirmed: true } }]);
    expect(result).toEqual({ charged: 990 });
  });

  it('is handed back to a tool resumed as a workflow step', async () => {
    const seen: Array<{ suspendPayload: unknown; resumeData: unknown }> = [];
    const step = createStep(createConfirmTool(seen));
    const workflow = createWorkflow({
      id: 'confirm-workflow',
      inputSchema: z.object({ amount: z.number() }),
      outputSchema: z.object({ charged: z.number() }),
    })
      .then(step)
      .commit();
    new Mastra({ workflows: { workflow }, logger: false, storage: new InMemoryStore() });

    const run = await workflow.createRun();
    const started = await run.start({ inputData: { amount: 990 } });
    expect(started.status).toBe('suspended');
    if (started.status !== 'suspended') return;
    expect(started.steps.confirmTool).toMatchObject({
      status: 'suspended',
      suspendPayload: { phase: 'confirm', amount: 990 },
    });

    const resumed = await run.resume({ step: 'confirmTool', resumeData: { confirmed: true } });
    expect(resumed.status).toBe('success');
    expect(seen).toEqual([{ suspendPayload: { phase: 'confirm', amount: 990 }, resumeData: { confirmed: true } }]);
    if (resumed.status === 'success') expect(resumed.result).toEqual({ charged: 990 });
  });

  it('is handed back to a tool resumed by a durable agent', async () => {
    const seen: Array<{ suspendPayload: unknown; resumeData: unknown }> = [];
    const pubsub = new EventEmitterPubSub();
    const agent = new Agent({
      id: 'durable-confirm-agent',
      name: 'Durable Confirm Agent',
      instructions: 'Charge after confirmation.',
      model: createModel(),
      tools: { confirmTool: createConfirmTool(seen) },
    });
    const durableAgent = createDurableAgent({ agent, pubsub });
    new Mastra({ agents: { durableAgent }, logger: false, storage: new InMemoryStore() });

    let suspended: unknown;
    const initial = await durableAgent.stream('Charge 990', {
      onSuspended: data => {
        suspended = data;
      },
    });
    await vi.waitFor(() => expect(suspended).toBeDefined());

    let finished = false;
    const resumed = await durableAgent.resume(
      initial.runId,
      { confirmed: true },
      {
        onFinish: () => {
          finished = true;
        },
      },
    );
    await vi.waitFor(() => expect(finished).toBe(true));

    expect(seen).toEqual([{ suspendPayload: { phase: 'confirm', amount: 990 }, resumeData: { confirmed: true } }]);

    resumed.cleanup();
    initial.cleanup();
    await pubsub.close();
  });
});
