/**
 * DurableAgent approval resume data forwarding
 *
 * `sendToolApproval({ approved, resumeData })` lets a caller attach extra keys to an
 * approval (e.g. user-edited arguments from an approval UI). The non-durable tool-call
 * step forwards such a payload to the tool and only drops the bare `{ approved }`.
 * The durable step must behave the same way.
 *
 * Regression test for https://github.com/mastra-ai/mastra/issues/24561
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

/** Creates a model that requests one tool call, then completes after the tool resumes. */
function createToolCallThenTextModel(tool: { name: string; args: object }) {
  let callCount = 0;
  return new MockLanguageModelV2({
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

async function runApprovalGatedTool(pubsub: EventEmitterPubSub, resumeData: Record<string, unknown>) {
  const seenResumeData: unknown[] = [];
  const approvalTool = createTool({
    id: 'approvalTool',
    description: 'approval-gated tool',
    inputSchema: z.object({ value: z.string() }),
    requireApproval: true,
    execute: async (_input, context) => {
      seenResumeData.push(context?.agent?.resumeData);
      return 'ok';
    },
  });
  const baseAgent = new Agent({
    id: 'approval-resume-data-agent',
    name: 'Approval Resume Data Agent',
    instructions: 'Use the approval tool.',
    model: createToolCallThenTextModel({ name: 'approvalTool', args: { value: 'test' } }) as LanguageModelV2,
    tools: { approvalTool },
  });
  const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
  new Mastra({
    logger: false,
    storage: new MockStore(),
    agents: { approvalResumeDataAgent: durableAgent },
  });

  let suspendedData: unknown;
  const initial = await durableAgent.stream('Run the approval tool', {
    onSuspended: data => {
      suspendedData = data;
    },
  });
  await vi.waitFor(() => expect(suspendedData).toBeDefined());
  expect(suspendedData).toMatchObject({ type: 'approval', toolCallId: 'call-1' });

  let finishData: unknown;
  const resumed = await durableAgent.resume(initial.runId, resumeData, {
    onFinish: data => {
      finishData = data;
    },
  });
  await vi.waitFor(() => expect(finishData).toBeDefined());

  resumed.cleanup();
  initial.cleanup();
  return seenResumeData;
}

describe('DurableAgent approval resume data', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('forwards an approval payload with extra keys to the tool', async () => {
    const seen = await runApprovalGatedTool(pubsub, { approved: true, note: 'hello' });
    expect(seen).toEqual([{ approved: true, note: 'hello' }]);
  });

  it('does not forward a bare { approved } payload to the tool', async () => {
    const seen = await runApprovalGatedTool(pubsub, { approved: true });
    expect(seen).toEqual([undefined]);
  });
});
