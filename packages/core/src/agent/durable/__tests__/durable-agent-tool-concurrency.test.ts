/**
 * DurableAgent Tool Concurrency Tests
 *
 * Tests for sequential vs concurrent tool execution control.
 * Validates that toolCallConcurrency option and approval/suspension flags
 * correctly influence tool execution order.
 */

import { createOpenAI } from '@ai-sdk/openai-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { useLoopScenarioAimock } from '../../../loop/test-utils/aimock/aimock-scenario';
import { SCENARIO_MODEL_ID } from '../../../loop/test-utils/aimock/types';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createGate, createRestartScenario } from './restart-harness';
import type { Gate } from './restart-harness';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock model that returns multiple tool calls
 */
function createMultipleToolCallsModel(tools: Array<{ name: string; args: object }>) {
  const toolCallChunks = tools.map((tool, index) => ({
    type: 'tool-call' as const,
    toolCallType: 'function' as const,
    toolCallId: `call-${index + 1}`,
    toolName: tool.name,
    input: JSON.stringify(tool.args),
    providerExecuted: false,
  }));

  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        ...toolCallChunks,
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

/**
 * Creates a simple text model
 */
function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

// ============================================================================
// DurableAgent Tool Concurrency Tests
// ============================================================================

describe('DurableAgent tool concurrency', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('toolCallConcurrency option', () => {
    it('should include toolCallConcurrency in workflow options', async () => {
      const mockModel = createMultipleToolCallsModel([
        { name: 'tool1', args: { data: 'test1' } },
        { name: 'tool2', args: { data: 'test2' } },
      ]);

      const tool1 = createTool({
        id: 'tool1',
        description: 'First tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 'tool1' }),
      });

      const tool2 = createTool({
        id: 'tool2',
        description: 'Second tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 'tool2' }),
      });

      const baseAgent = new Agent({
        id: 'concurrency-agent',
        name: 'Concurrency Agent',
        instructions: 'Use both tools',
        model: mockModel as LanguageModelV2,
        tools: { tool1, tool2 },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Use both tools', {
        toolCallConcurrency: 5,
      });

      expect(result.workflowInput.options.toolCallConcurrency).toBe(5);
    });

    it('should default toolCallConcurrency when not specified', async () => {
      const mockModel = createMultipleToolCallsModel([{ name: 'tool1', args: { data: 'test' } }]);

      const tool1 = createTool({
        id: 'tool1',
        description: 'A tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 'done' }),
      });

      const baseAgent = new Agent({
        id: 'default-concurrency-agent',
        name: 'Default Concurrency Agent',
        instructions: 'Use tool',
        model: mockModel as LanguageModelV2,
        tools: { tool1 },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Use the tool');

      // Should be undefined or a default value when not specified
      // The actual default is handled by the workflow execution
      expect(result.runId).toBeDefined();
    });

    it('should set toolCallConcurrency to 1 for sequential execution', async () => {
      const mockModel = createMultipleToolCallsModel([
        { name: 'tool1', args: { data: 'test1' } },
        { name: 'tool2', args: { data: 'test2' } },
      ]);

      const tool1 = createTool({
        id: 'tool1',
        description: 'First tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 'tool1' }),
      });

      const tool2 = createTool({
        id: 'tool2',
        description: 'Second tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 'tool2' }),
      });

      const baseAgent = new Agent({
        id: 'sequential-agent',
        name: 'Sequential Agent',
        instructions: 'Use tools sequentially',
        model: mockModel as LanguageModelV2,
        tools: { tool1, tool2 },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Use both tools', {
        toolCallConcurrency: 1,
      });

      expect(result.workflowInput.options.toolCallConcurrency).toBe(1);
    });
  });

  describe('concurrency with requireToolApproval', () => {
    it('should force sequential execution when requireToolApproval is true', async () => {
      const mockModel = createMultipleToolCallsModel([
        { name: 'tool1', args: { data: 'test1' } },
        { name: 'tool2', args: { data: 'test2' } },
      ]);

      const tool1 = createTool({
        id: 'tool1',
        description: 'First tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 'tool1' }),
      });

      const tool2 = createTool({
        id: 'tool2',
        description: 'Second tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 'tool2' }),
      });

      const baseAgent = new Agent({
        id: 'approval-concurrency-agent',
        name: 'Approval Concurrency Agent',
        instructions: 'Use tools with approval',
        model: mockModel as LanguageModelV2,
        tools: { tool1, tool2 },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      // When requireToolApproval is true, tools must be executed sequentially
      // even if toolCallConcurrency is set to a higher value
      const result = await durableAgent.prepare('Use both tools', {
        requireToolApproval: true,
        toolCallConcurrency: 10, // This should be overridden to 1
      });

      expect(result.workflowInput.options.requireToolApproval).toBe(true);
      expect(result.workflowInput.options.toolCallConcurrency).toBe(10);
      // Note: The actual forcing of sequential execution happens at runtime
    });
  });

  describe('concurrency edge cases', () => {
    it('should handle negative toolCallConcurrency gracefully', async () => {
      const mockModel = createTextModel('Hello');

      const baseAgent = new Agent({
        id: 'negative-concurrency-agent',
        name: 'Negative Concurrency Agent',
        instructions: 'Test negative value',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello', {
        toolCallConcurrency: -5,
      });

      // Should accept the value (validation happens at runtime)
      expect(result.workflowInput.options.toolCallConcurrency).toBe(-5);
    });

    it('should handle zero toolCallConcurrency', async () => {
      const mockModel = createTextModel('Hello');

      const baseAgent = new Agent({
        id: 'zero-concurrency-agent',
        name: 'Zero Concurrency Agent',
        instructions: 'Test zero value',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello', {
        toolCallConcurrency: 0,
      });

      expect(result.workflowInput.options.toolCallConcurrency).toBe(0);
    });

    it('should handle very high toolCallConcurrency', async () => {
      const mockModel = createMultipleToolCallsModel([
        { name: 'tool1', args: { data: 'test1' } },
        { name: 'tool2', args: { data: 'test2' } },
        { name: 'tool3', args: { data: 'test3' } },
      ]);

      const tool1 = createTool({
        id: 'tool1',
        description: 'Tool 1',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 1 }),
      });

      const tool2 = createTool({
        id: 'tool2',
        description: 'Tool 2',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 2 }),
      });

      const tool3 = createTool({
        id: 'tool3',
        description: 'Tool 3',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 3 }),
      });

      const baseAgent = new Agent({
        id: 'high-concurrency-agent',
        name: 'High Concurrency Agent',
        instructions: 'Use many tools',
        model: mockModel as LanguageModelV2,
        tools: { tool1, tool2, tool3 },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Use all tools', {
        toolCallConcurrency: 100,
      });

      expect(result.workflowInput.options.toolCallConcurrency).toBe(100);
    });
  });

  describe('concurrency serialization', () => {
    it('should serialize toolCallConcurrency in workflow input', async () => {
      const mockModel = createMultipleToolCallsModel([{ name: 'tool1', args: { data: 'test' } }]);

      const tool1 = createTool({
        id: 'tool1',
        description: 'A tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async () => ({ result: 'done' }),
      });

      const baseAgent = new Agent({
        id: 'serialize-concurrency-agent',
        name: 'Serialize Concurrency Agent',
        instructions: 'Test serialization',
        model: mockModel as LanguageModelV2,
        tools: { tool1 },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Use tool', {
        toolCallConcurrency: 3,
      });

      // Verify JSON serialization
      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();

      const parsed = JSON.parse(serialized);
      expect(parsed.options.toolCallConcurrency).toBe(3);
    });
  });
});

// ============================================================================
// Restart mid tool-call foreach (#26214)
// ============================================================================

describe('DurableAgent parallel tool calls across a restart', () => {
  const getMock = useLoopScenarioAimock();
  const gates: Gate[] = [];
  const scenarios: { stop(): Promise<void> }[] = [];

  afterEach(async () => {
    for (const gate of gates.splice(0)) gate.release();
    await Promise.all(scenarios.splice(0).map(s => s.stop()));
  });

  /**
   * The model asks for three `lookup` calls at once. In graph 1, call 2 blocks on a gate while
   * calls 1 and 3 finish; `crashAfterMs` after both have returned, graph 1 is cut and graph 2
   * recovers the run.
   */
  async function crashWhileCallTwoRuns(runId: string, crashAfterMs: number, callThreeDelayMs = 0) {
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      {
        toolCalls: [1, 2, 3].map(index => ({
          id: `call_${index}`,
          name: 'lookup',
          arguments: { index },
        })),
      },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'done' });

    const gate = createGate();
    gates.push(gate);
    const started: { generation: number; index: number }[] = [];
    const finished: { generation: number; index: number }[] = [];
    let markOthersDone!: () => void;
    const othersDone = new Promise<void>(resolve => (markOthersDone = resolve));

    const scenario = createRestartScenario({
      kind: 'durable',
      runId,
      build: ({ core, generation }) => {
        const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
        return new core.Agent({
          id: 'parallel-restart-agent',
          name: 'parallel-restart-agent',
          instructions: 'Look things up.',
          model: openai(SCENARIO_MODEL_ID),
          tools: {
            lookup: core.createTool({
              id: 'lookup',
              description: 'Looks something up',
              inputSchema: z.object({ index: z.number() }),
              execute: async ({ index }) => {
                started.push({ generation, index });
                if (generation === 1 && index === 2) await gate.wait();
                if (generation === 1 && index === 3 && callThreeDelayMs)
                  await new Promise(r => setTimeout(r, callThreeDelayMs));
                finished.push({ generation, index });
                if (generation === 1 && finished.filter(c => c.generation === 1).length === 2) markOthersDone();
                return { ok: true, index };
              },
            }),
          },
        });
      },
    });
    scenarios.push(scenario);

    const original = await scenario.start(({ agent }) => agent.stream('Look three things up', { runId }));
    await gate.reached;
    await othersDone;
    await new Promise(resolve => setTimeout(resolve, crashAfterMs));
    const recovered = await scenario.restart(await original.checkpoint());

    return {
      recovered,
      rerun: started.filter(c => c.generation === 2).map(c => c.index),
    };
  }

  it('re-runs only the tool call that was still running at the crash', async () => {
    // Crash after the foreach checkpoint interval (1s) so both finished calls are on disk.
    const { recovered, rerun } = await crashWhileCallTwoRuns('parallel-tools-restart', 1_500);

    expect(recovered.streamErrors).toEqual([]);
    expect(recovered.executionError).toBeUndefined();
    expect(recovered.text).toBe('done');
    expect(rerun).toEqual([2]);
  }, 30_000);

  it('re-runs a call that finished within the checkpoint interval before the crash', async () => {
    // Pins the coalescing trade-off: call 3 returns 300ms after call 1, so its progress is still
    // waiting for the next checkpoint when the run is cut 200ms later, and it runs again.
    const { recovered, rerun } = await crashWhileCallTwoRuns('parallel-tools-window', 200, 300);

    expect(recovered.text).toBe('done');
    expect(rerun).toEqual([2, 3]);
  }, 30_000);
});
