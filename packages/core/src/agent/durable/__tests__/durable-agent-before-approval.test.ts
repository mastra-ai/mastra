/**
 * DurableAgent per-tool beforeApproval hook tests (#26772)
 */

import type { LanguageModelV4 } from '@ai-sdk/provider';
import { MockLanguageModelV4, convertArrayToReadableStream } from '@internal/ai-v7/test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import type { AgentStreamEvent } from '../types';

/** Creates a model that requests one tool call, then completes after the tool resumes. */
function createToolCallThenTextModel(tool: { name: string; args: object }) {
  let callCount = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      callCount++;
      return {
        stream: convertArrayToReadableStream(
          callCount === 1
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-1',
                  toolName: tool.name,
                  input: JSON.stringify(tool.args),
                  providerExecuted: false,
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'done' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ],
        ),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

function collectPubsubEvents(pubsub: EventEmitterPubSub, runId: string) {
  const events: AgentStreamEvent[] = [];
  pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
    events.push(event as unknown as AgentStreamEvent);
  });
  return events;
}

describe('DurableAgent beforeApproval hook (#26772)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  const setup = (beforeApproval: (input: { orderId: string }) => unknown, execute = vi.fn(async () => 'refunded')) => {
    const issueRefund = createTool({
      id: 'issueRefund',
      description: 'Issue a refund',
      inputSchema: z.object({ orderId: z.string() }),
      requireApproval: true,
      beforeApproval: beforeApproval as any,
      execute,
    });
    const baseAgent = new Agent({
      id: 'before-approval-agent',
      name: 'Before Approval Agent',
      instructions: 'Refund orders.',
      model: createToolCallThenTextModel({ name: 'issueRefund', args: { orderId: 'missing' } }) as LanguageModelV4,
      tools: { issueRefund },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({ logger: false, storage: new MockStore(), agents: { beforeApprovalAgent: durableAgent } });
    return { durableAgent, execute };
  };

  it('returns the rejection to the model without suspending or executing', async () => {
    const beforeApproval = vi.fn(async ({ orderId }: { orderId: string }) => ({
      proceed: false as const,
      output: { error: `Order ${orderId} not found` },
    }));
    const { durableAgent, execute } = setup(beforeApproval);

    const prep = await durableAgent.prepare('Refund order missing');
    const events = collectPubsubEvents(pubsub, prep.runId);
    let finishData: unknown;
    let suspended = false;
    const { cleanup } = await durableAgent.stream('Refund order missing', {
      runId: prep.runId,
      onSuspended: () => {
        suspended = true;
      },
      onFinish: data => {
        finishData = data;
      },
    });
    await vi.waitFor(() => expect(finishData).toBeDefined());

    const chunks = events.filter(e => e.type === AgentStreamEventTypes.CHUNK).map(e => (e as any).data);
    expect(beforeApproval).toHaveBeenCalledWith(
      { orderId: 'missing' },
      expect.objectContaining({ toolCallId: 'call-1', toolName: 'issueRefund' }),
    );
    expect(suspended).toBe(false);
    expect(execute).not.toHaveBeenCalled();
    expect(chunks.some(c => c?.type === 'tool-call-approval')).toBe(false);
    expect(chunks.find(c => c?.type === 'tool-result')?.payload).toMatchObject({
      toolCallId: 'call-1',
      result: { error: 'Order missing not found' },
    });

    cleanup();
  });

  it('suspends for approval when the hook lets the call through, and does not re-run it on resume', async () => {
    const beforeApproval = vi.fn(async () => undefined);
    const { durableAgent, execute } = setup(beforeApproval);

    let suspendedData: unknown;
    const initial = await durableAgent.stream('Refund order missing', {
      onSuspended: data => {
        suspendedData = data;
      },
    });
    await vi.waitFor(() => expect(suspendedData).toBeDefined());
    expect(beforeApproval).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();

    let finishData: unknown;
    const resumed = await durableAgent.resume(
      initial.runId,
      { approved: true },
      {
        onFinish: data => {
          finishData = data;
        },
      },
    );
    await vi.waitFor(() => expect(finishData).toBeDefined());

    expect(beforeApproval).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);

    resumed.cleanup();
    initial.cleanup();
  });
});
