/**
 * DurableAgent Delegation Bail Tests
 *
 * Verifies that when a delegation `onDelegationComplete` hook calls
 * `ctx.bail()`, the durable loop stops after the current iteration,
 * mirroring the regular agent's `DELEGATION_BAILED_KEY` behaviour.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function makeSubAgentModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'sub-0', modelId: 'mock-model', timestamp: new Date(0) },
        { type: 'text-start', id: 'sub-text' },
        { type: 'text-delta', id: 'sub-text', delta: text },
        { type: 'text-end', id: 'sub-text' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/**
 * Supervisor model that always delegates to a sub-agent. Each call
 * produces a tool-call to `agent-{key}`, forcing the loop to keep
 * delegating unless something (e.g. bail) stops it.
 */
function makeAlwaysDelegatingModel(agentKey: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'sup-0', modelId: 'mock-model', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: `sup-call-${Date.now()}`,
          toolName: `agent-${agentKey}`,
          input: JSON.stringify({ prompt: 'do something' }),
          providerExecuted: false,
        },
        {
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('DurableAgent delegation bail', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('stops the loop when onDelegationComplete calls ctx.bail()', async () => {
    const onDelegationComplete = vi.fn(ctx => {
      ctx.bail();
      return undefined;
    });

    const subAgent = new Agent({
      id: 'helperAgent',
      name: 'helperAgent',
      description: 'A helper agent',
      instructions: 'You are helpful.',
      model: makeSubAgentModel('I helped!') as LanguageModelV2,
    });

    // Supervisor always delegates — without bail, it would loop until maxSteps
    const supervisor = new Agent({
      id: 'supervisor-bail',
      name: 'supervisor-bail',
      instructions: 'Delegate everything.',
      model: makeAlwaysDelegatingModel('helperAgent') as LanguageModelV2,
      agents: { helperAgent: subAgent },
    });

    const durableAgent = createDurableAgent({ agent: supervisor, pubsub });

    const { fullStream, cleanup } = await durableAgent.stream('Go', {
      maxSteps: 5,
      delegation: { onDelegationComplete },
    });

    const chunks: unknown[] = [];
    for await (const chunk of fullStream) {
      chunks.push(chunk);
    }

    // Bail should have stopped the loop after 1 iteration (one delegation)
    expect(onDelegationComplete).toHaveBeenCalledTimes(1);

    // Verify the loop actually stopped — without bail, we'd see ≥ 2 iterations
    // (the maxSteps is 5, so the model would be called at least twice)
    // With bail, we should only see 1 tool-call + 1 tool-result cycle
    const toolCallChunks = chunks.filter((c: any) => c?.type === 'tool-call');
    expect(toolCallChunks.length).toBe(1);

    cleanup();
  });
});
