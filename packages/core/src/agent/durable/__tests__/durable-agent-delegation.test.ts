/**
 * DurableAgent Delegation Tests
 *
 * Verifies that per-call `delegation` hooks (`onDelegationStart`,
 * `onDelegationComplete`) flow through `DurableAgent.stream()` /
 * `prepare()` into the sub-agent CoreTool wrappers stored on the
 * in-process run registry.
 *
 * The closures live only on the registry: `convertTools` bakes them
 * into the sub-agent tool at prepare time. Cross-process resume on a
 * fresh worker degrades to default delegation behaviour.
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

/** Sub-agent: streams a single text response */
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
 * Supervisor: first turn calls `agent-{key}`; second turn stops.
 */
function makeSupervisorModel(agentKey: string, prompt: string) {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      if (calls === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'sup-0', modelId: 'mock-model', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'sup-call-1',
              toolName: `agent-${agentKey}`,
              input: JSON.stringify({ prompt }),
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
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'sup-1', modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'sup-text' },
          { type: 'text-delta', id: 'sup-text', delta: 'Done' },
          { type: 'text-end', id: 'sup-text' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

function makeSubAgent(id: string, text: string) {
  return new Agent({
    id,
    name: id,
    description: `Sub-agent ${id}`,
    instructions: 'You are a helpful sub-agent.',
    model: makeSubAgentModel(text) as LanguageModelV2,
  });
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('DurableAgent delegation hooks', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('invokes onDelegationStart when the supervisor delegates to a sub-agent', async () => {
    const onDelegationStart = vi.fn(() => ({ proceed: true as const }));

    const subAgent = makeSubAgent('researchAgent', 'Dolphins are marine mammals.');

    const supervisor = new Agent({
      id: 'supervisor-delegation-start',
      name: 'supervisor-delegation-start',
      instructions: 'You orchestrate sub-agents.',
      model: makeSupervisorModel('researchAgent', 'research dolphins') as LanguageModelV2,
      agents: { researchAgent: subAgent },
    });

    const durableAgent = createDurableAgent({ agent: supervisor, pubsub });

    const { fullStream, cleanup } = await durableAgent.stream('Research dolphins', {
      maxSteps: 3,
      delegation: { onDelegationStart },
    });

    // Drain the stream so the full agentic loop completes
    for await (const _chunk of fullStream) {
      // no-op
    }

    expect(onDelegationStart).toHaveBeenCalledTimes(1);
    expect(onDelegationStart).toHaveBeenCalledWith(
      expect.objectContaining({
        primitiveType: 'agent',
        prompt: 'research dolphins',
      }),
    );

    cleanup();
  });

  it('invokes onDelegationComplete with the sub-agent result', async () => {
    const onDelegationComplete = vi.fn(() => undefined);

    const subAgent = makeSubAgent('writerAgent', 'Here is the final report.');

    const supervisor = new Agent({
      id: 'supervisor-delegation-complete',
      name: 'supervisor-delegation-complete',
      instructions: 'You orchestrate sub-agents.',
      model: makeSupervisorModel('writerAgent', 'write a report') as LanguageModelV2,
      agents: { writerAgent: subAgent },
    });

    const durableAgent = createDurableAgent({ agent: supervisor, pubsub });

    const { fullStream, cleanup } = await durableAgent.stream('Write a report', {
      maxSteps: 3,
      delegation: { onDelegationComplete },
    });

    for await (const _chunk of fullStream) {
      // no-op
    }

    expect(onDelegationComplete).toHaveBeenCalledTimes(1);
    expect(onDelegationComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        primitiveType: 'agent',
        result: expect.objectContaining({ text: 'Here is the final report.' }),
      }),
    );

    cleanup();
  });
});
