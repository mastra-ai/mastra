/**
 * Tests for DurableAgent honoring the wrapped agent's defaultOptions.
 *
 * Regression coverage for #17790: DurableAgent.stream()/prepare() previously
 * passed the per-request options straight into prepareForDurableExecution
 * without merging the wrapped agent's defaultOptions. As a result maxSteps
 * silently fell back to DurableAgentDefaults.MAX_STEPS (5) and providerOptions
 * were dropped. These tests assert the defaults now flow into the serialized
 * workflow input, mirroring the non-durable Agent.stream()/generate() paths.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { MASTRA_VERSIONS_KEY, RequestContext } from '../../../request-context';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function createMockModel() {
  return {
    provider: 'test',
    modelId: 'test-model',
    specificationVersion: 'v1',
    supportsStructuredOutputs: true,
    doGenerate: vi.fn(),
    doStream: vi.fn(),
  };
}

/**
 * Mock model that emits `toolIterations` tool calls then a final text response,
 * counting how many times it was invoked so we can assert the agentic loop ran
 * the expected number of steps.
 */
function createRepeatedToolThenTextModel(
  toolName: string,
  toolArgs: object,
  toolIterations: number,
  finalText: string,
) {
  let callCount = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      callCount += 1;
      const stream: ReadableStream<any> =
        callCount <= toolIterations
          ? convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: `call-${callCount}`,
                toolName,
                input: JSON.stringify(toolArgs),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ])
          : convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: finalText },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
            ]);
      return { stream, rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [] };
    },
  });
  return { model, getCallCount: () => callCount };
}

async function drain(stream: ReadableStream<any>): Promise<void> {
  const reader = stream.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
}

describe('DurableAgent defaultOptions (#17790)', () => {
  let model: ReturnType<typeof createMockModel>;

  beforeEach(() => {
    model = createMockModel();
  });

  describe('getDefaultOptions delegation', () => {
    it('delegates getDefaultOptions to the wrapped agent', async () => {
      const base = new Agent({
        id: 'base',
        name: 'Base',
        instructions: 'You are a test agent',
        model: model as any,
        defaultOptions: {
          maxSteps: 250,
          providerOptions: { anthropic: { thinking: { type: 'adaptive' }, effort: 'high' } } as any,
        },
      });

      const durableAgent = createDurableAgent({ agent: base });

      const defaults = await durableAgent.getDefaultOptions();
      expect(defaults.maxSteps).toBe(250);
      expect((defaults.providerOptions as any)?.anthropic?.effort).toBe('high');
    });

    it('returns the same resolved defaults as the wrapped agent', async () => {
      const base = new Agent({
        id: 'base',
        name: 'Base',
        instructions: 'You are a test agent',
        model: model as any,
        defaultOptions: { maxSteps: 42 },
      });

      const durableAgent = createDurableAgent({ agent: base });

      const fromWrapped = await base.getDefaultOptions();
      const fromDurable = await durableAgent.getDefaultOptions();
      expect(fromDurable).toEqual(fromWrapped);
    });
  });

  describe('prepare() merges defaultOptions into workflow input', () => {
    it('serializes the wrapped agent maxSteps into workflowInput', async () => {
      const base = new Agent({
        id: 'base',
        name: 'Base',
        instructions: 'You are a test agent',
        model: model as any,
        defaultOptions: { maxSteps: 250 },
      });

      const durableAgent = createDurableAgent({ agent: base });

      const { workflowInput } = await durableAgent.prepare('Hello');
      expect(workflowInput.options.maxSteps).toBe(250);
    });

    it('serializes the wrapped agent providerOptions into workflowInput', async () => {
      const providerOptions = { anthropic: { thinking: { type: 'adaptive' }, effort: 'high' } };
      const base = new Agent({
        id: 'base',
        name: 'Base',
        instructions: 'You are a test agent',
        model: model as any,
        defaultOptions: { providerOptions: providerOptions as any },
      });

      const durableAgent = createDurableAgent({ agent: base });

      const { workflowInput } = await durableAgent.prepare('Hello');
      expect(workflowInput.options.providerOptions).toEqual(providerOptions);
    });

    it('lets per-request options override defaultOptions', async () => {
      const base = new Agent({
        id: 'base',
        name: 'Base',
        instructions: 'You are a test agent',
        model: model as any,
        defaultOptions: { maxSteps: 250 },
      });

      const durableAgent = createDurableAgent({ agent: base });

      const { workflowInput } = await durableAgent.prepare('Hello', { maxSteps: 7 } as any);
      expect(workflowInput.options.maxSteps).toBe(7);
    });

    it('deep-merges nested providerOptions (per-request wins on conflicts)', async () => {
      const base = new Agent({
        id: 'base',
        name: 'Base',
        instructions: 'You are a test agent',
        model: model as any,
        defaultOptions: {
          providerOptions: { anthropic: { thinking: { type: 'adaptive' }, effort: 'high' } } as any,
        },
      });

      const durableAgent = createDurableAgent({ agent: base });

      const { workflowInput } = await durableAgent.prepare('Hello', {
        providerOptions: { anthropic: { effort: 'low' } } as any,
      } as any);

      // Nested keys from defaults survive, the conflicting key is overridden.
      expect(workflowInput.options.providerOptions).toEqual({
        anthropic: { thinking: { type: 'adaptive' }, effort: 'low' },
      });
    });

    it('leaves maxSteps unset when neither defaults nor per-request provide it', async () => {
      const base = new Agent({
        id: 'base',
        name: 'Base',
        instructions: 'You are a test agent',
        model: model as any,
      });

      const durableAgent = createDurableAgent({ agent: base });

      const { workflowInput } = await durableAgent.prepare('Hello');
      // Undefined here means the workflow applies its own default (MAX_STEPS).
      expect(workflowInput.options.maxSteps).toBeUndefined();
    });

    it('resolves function-valued defaultOptions with the request context', async () => {
      const base = new Agent({
        id: 'base',
        name: 'Base',
        instructions: 'You are a test agent',
        model: model as any,
        defaultOptions: () => ({ maxSteps: 99 }),
      });

      const durableAgent = createDurableAgent({ agent: base });

      const { workflowInput } = await durableAgent.prepare('Hello', {
        requestContext: new RequestContext(),
      } as any);
      expect(workflowInput.options.maxSteps).toBe(99);
    });
  });

  describe('version overrides from defaultOptions', () => {
    it('feeds defaultOptions.versions into the request context version merge', async () => {
      const base = new Agent({
        id: 'base',
        name: 'Base',
        instructions: 'You are a test agent',
        model: model as any,
        defaultOptions: {
          versions: { agents: { 'sub-agent': { versionId: 'from-defaults' } } },
        } as any,
      });

      const durableAgent = createDurableAgent({ agent: base });

      const { registryEntry } = await durableAgent.prepare('Hello');
      const versions = registryEntry.requestContext?.get(MASTRA_VERSIONS_KEY) as any;
      expect(versions?.agents?.['sub-agent']).toEqual({ versionId: 'from-defaults' });
    });

    it('lets per-request versions override defaultOptions.versions', async () => {
      const base = new Agent({
        id: 'base',
        name: 'Base',
        instructions: 'You are a test agent',
        model: model as any,
        defaultOptions: {
          versions: { agents: { 'sub-agent': { versionId: 'from-defaults' } } },
        } as any,
      });

      const durableAgent = createDurableAgent({ agent: base });

      const { registryEntry } = await durableAgent.prepare('Hello', {
        versions: { agents: { 'sub-agent': { versionId: 'from-request' } } },
      } as any);
      const versions = registryEntry.requestContext?.get(MASTRA_VERSIONS_KEY) as any;
      expect(versions?.agents?.['sub-agent']).toEqual({ versionId: 'from-request' });
    });
  });

  describe('end-to-end: agentic loop honors defaultOptions.maxSteps', () => {
    let pubsub: EventEmitterPubSub;

    beforeEach(() => {
      pubsub = new EventEmitterPubSub();
    });

    afterEach(async () => {
      await pubsub.close();
    });

    it('runs the loop past the durable default (5) using defaultOptions.maxSteps, with no per-request maxSteps', async () => {
      // Model wants 6 tool iterations + 1 final text = 7 LLM calls. Before the fix
      // defaultOptions was ignored and the loop capped at DurableAgentDefaults.MAX_STEPS (5).
      const { model: loopModel, getCallCount } = createRepeatedToolThenTextModel(
        'loopTool',
        { value: 'next' },
        6,
        'done',
      );

      const loopTool = createTool({
        id: 'loopTool',
        description: 'Continue the loop',
        inputSchema: z.object({ value: z.string() }),
        execute: async () => ({ ok: true }),
      });

      const baseAgent = new Agent({
        id: 'e2e-default-maxsteps-agent',
        name: 'E2E Default MaxSteps Agent',
        instructions: 'Use tools until done.',
        model: loopModel as LanguageModelV2,
        tools: { loopTool },
        defaultOptions: { maxSteps: 10 },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      // Note: no maxSteps passed here — it must come from the wrapped agent's defaultOptions.
      const result = await durableAgent.stream('Loop until final answer');
      await drain(result.fullStream as ReadableStream<any>);

      // 6 tool calls + 1 final text response. Would be 5 if defaultOptions were ignored.
      expect(getCallCount()).toBe(7);
      result.cleanup();
    });
  });
});
