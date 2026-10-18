/**
 * DurableAgent Structured Output Tests
 *
 * Tests for typed structured output with Zod and JSON schemas in durable execution.
 * Validates that structuredOutput option works correctly through the durable workflow.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { z as z3 } from 'zod/v3';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { durableOptionsSchema } from '../workflows/shared/schemas';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock model that returns structured JSON output
 */
function createStructuredOutputModel(jsonOutput: object) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [
        {
          type: 'text',
          text: JSON.stringify(jsonOutput),
        },
      ],
      warnings: [],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: JSON.stringify(jsonOutput) },
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

/**
 * Creates a mock model that streams structured JSON output in chunks
 */
function createChunkedStructuredOutputModel(jsonOutput: object) {
  const jsonString = JSON.stringify(jsonOutput);
  // Split into chunks
  const chunks = [
    jsonString.slice(0, Math.floor(jsonString.length / 3)),
    jsonString.slice(Math.floor(jsonString.length / 3), Math.floor((2 * jsonString.length) / 3)),
    jsonString.slice(Math.floor((2 * jsonString.length) / 3)),
  ];

  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: chunks[0] },
        { type: 'text-delta', id: 'text-1', delta: chunks[1] },
        { type: 'text-delta', id: 'text-1', delta: chunks[2] },
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

/**
 * Creates a mock model that returns tool-calls finishReason (Bedrock-style)
 */
function createBedrockStyleModel(jsonOutput: object) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'tool-calls',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      content: [
        {
          type: 'text',
          text: JSON.stringify(jsonOutput),
        },
      ],
      warnings: [],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'bedrock-mock', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        {
          type: 'text-delta',
          id: 'text-1',
          delta: JSON.stringify(jsonOutput),
        },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

// ============================================================================
// DurableAgent Structured Output Tests
// ============================================================================

describe('DurableAgent structured output', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should preserve structured output when observing a completed run', async () => {
    const expectedOutput = {
      answer: 'ok',
      n: 2,
    };
    const baseAgent = new Agent({
      id: 'observe-structured-output-agent',
      name: 'Observe Structured Output Agent',
      instructions: 'Return the requested structured output',
      model: createChunkedStructuredOutputModel(expectedOutput) as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const producer = await durableAgent.stream('Return the answer', {
      structuredOutput: {
        schema: z.object({
          answer: z.string(),
          n: z.number(),
        }),
      },
    });
    const producerOutput = await producer.output.getFullOutput();

    const observer = await durableAgent.observe(producer.runId, { offset: 0 });
    const observerOutput = await observer.output.getFullOutput();

    expect(producerOutput.object).toEqual(expectedOutput);
    expect(observerOutput.text).toBe(producerOutput.text);
    expect(observerOutput.finishReason).toBe('stop');
    expect(observerOutput.object).toEqual(producerOutput.object);

    observer.cleanup();
  });
});

describe('DurableAgent structured output workflow integration', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should include structuredOutput schema info in workflow input serialization', async () => {
    const expectedOutput = { count: 42, items: ['a', 'b', 'c'] };
    const mockModel = createStructuredOutputModel(expectedOutput);

    const schema = z.object({
      count: z.number(),
      items: z.array(z.string()),
    });

    const baseAgent = new Agent({
      id: 'serialization-test-agent',
      name: 'Serialization Test Agent',
      instructions: 'Test serialization',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare('Get data', {
      structuredOutput: {
        schema,
      },
    });

    // Verify workflow input is JSON-serializable
    const serialized = JSON.stringify(result.workflowInput);
    expect(serialized).toBeDefined();

    // Parse it back to verify it's valid JSON
    const parsed = JSON.parse(serialized);
    expect(parsed.runId).toBe(result.runId);
    expect(parsed.agentId).toBe('serialization-test-agent');
  });

  it('should properly serialize complex schemas with descriptions', async () => {
    const expectedOutput = { status: 'active' };
    const mockModel = createStructuredOutputModel(expectedOutput);

    const schema = z.object({
      status: z.enum(['active', 'inactive', 'pending']).describe('Current user status'),
    });

    const baseAgent = new Agent({
      id: 'described-schema-agent',
      name: 'Described Schema Agent',
      instructions: 'Test described schemas',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare('Get status', {
      structuredOutput: {
        schema,
      },
    });

    // Verify workflow input is JSON-serializable
    const serialized = JSON.stringify(result.workflowInput);
    expect(serialized).toBeDefined();
    expect(JSON.parse(serialized)).toBeDefined();
  });

  // COR-1308: a Zod v4 schema has its own `type` property, so it used to be
  // mistaken for JSON Schema and stored as a live instance. The evented engine
  // then JSON round-trips workflow input between steps, leaving a schema with
  // no `properties` that OpenAI rejects on the second model call.
  const cases: Array<[string, () => unknown]> = [
    ['Zod v4', () => z.object({ name: z.string(), age: z.number() })],
    ['Zod v3', () => z3.object({ name: z3.string(), age: z3.number() })],
    [
      'plain JSON Schema',
      () => ({
        type: 'object',
        properties: { name: { type: 'string' }, age: { type: 'number' } },
        required: ['name', 'age'],
        additionalProperties: false,
      }),
    ],
  ];

  it.each(cases)('%s schema keeps its properties across a JSON round trip', async (_label, makeSchema) => {
    const baseAgent = new Agent({
      id: 'round-trip-agent',
      name: 'Round Trip Agent',
      instructions: 'Test round trip',
      model: createStructuredOutputModel({ name: 'a', age: 1 }) as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare('Get person', {
      structuredOutput: { schema: makeSchema() as any },
    });

    const roundTripped = JSON.parse(JSON.stringify(result.workflowInput));
    const schema = roundTripped.options.structuredOutput.schema;
    expect(schema).toEqual(result.workflowInput.options.structuredOutput?.schema);
    expect(schema.type).toBe('object');
    expect(Object.keys(schema.properties)).toEqual(['name', 'age']);
    expect(schema.required).toEqual(['name', 'age']);
    expect(durableOptionsSchema.safeParse(result.workflowInput.options).success).toBe(true);
  });

  it('rejects durable options that carry a live schema instance', () => {
    const parsed = durableOptionsSchema.safeParse({
      structuredOutput: { schema: z.object({ name: z.string() }) },
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toContain('options.structuredOutput.schema');
  });

  it.each([
    ['NaN', { modelSettings: { temperature: NaN } }, 'options.modelSettings.temperature'],
    ['Infinity', { maxSteps: Infinity }, 'options.maxSteps'],
    ['undefined array item', { activeTools: ['a', undefined] }, 'options.activeTools[1]'],
  ])('rejects %s, which JSON turns into null', (_label, options, path) => {
    const parsed = durableOptionsSchema.safeParse(options);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toContain(path);
  });

  it('accepts undefined properties and shared (non-cyclic) references', () => {
    const shared = { type: 'string' };
    expect(
      durableOptionsSchema.safeParse({ maxSteps: undefined, providerOptions: { a: shared, b: shared } }).success,
    ).toBe(true);
  });

  it('rejects cyclic options', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const parsed = durableOptionsSchema.safeParse({ providerOptions: cyclic });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toContain('options.providerOptions.self');
  });
});

// ============================================================================
// Compact structuredOutput.instructions across the durable boundary (#23798)
// ============================================================================

describe('DurableAgent compact structuredOutput.instructions (issue #23798)', () => {
  let pubsub: EventEmitterPubSub;

  const INSTRUCTIONS = 'FIELDS: a,b';
  const INLINE_SCHEMA_PREFIX = 'Return your response as JSON matching this schema';
  const SYSTEM_SCHEMA_PREFIX = 'JSON schema:';
  const SENTINEL = '__mastra23798Sentinel';
  const sentinelSchema = z.object({ __mastra23798Sentinel: z.string() });

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  function createCapturingModel(promptSnapshots: any[][], onCalled: () => void) {
    return new MockLanguageModelV2({
      doStream: async ({ prompt }: any) => {
        promptSnapshots.push(prompt);
        onCalled();
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: JSON.stringify({ __mastra23798Sentinel: 'ok' }) },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        };
      },
    });
  }

  async function runDurable(structuredOutput: any, agentId: string) {
    const promptSnapshots: any[][] = [];
    let resolveCalled: () => void;
    const calledPromise = new Promise<void>(r => {
      resolveCalled = r;
    });
    const mockModel = createCapturingModel(promptSnapshots, () => resolveCalled());

    const baseAgent = new Agent({
      id: agentId,
      name: agentId,
      instructions: 'Agent system instructions.',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const { cleanup } = await durableAgent.stream('Extract now.', { structuredOutput, onChunk: () => {} });
    await calledPromise;
    await cleanup?.();

    return JSON.stringify(promptSnapshots[0]);
  }

  it('serializes instructions into the durable workflow input', async () => {
    const baseAgent = new Agent({
      id: 'durable-instructions-serialization',
      name: 'Durable Instructions Serialization',
      instructions: 'Test serialization',
      model: createStructuredOutputModel({ __mastra23798Sentinel: 'ok' }) as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare('Extract now.', {
      structuredOutput: { schema: sentinelSchema, jsonPromptInjection: 'system', instructions: INSTRUCTIONS },
    });

    expect((result.workflowInput as any).options.structuredOutput.instructions).toBe(INSTRUCTIONS);
  });

  it('serializes structuring-agent instructions when a separate structuring model is configured', async () => {
    const baseAgent = new Agent({
      id: 'durable-instructions-structuring-model',
      name: 'Durable Instructions Structuring Model',
      instructions: 'Test serialization',
      model: createStructuredOutputModel({ __mastra23798Sentinel: 'ok' }) as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare('Extract now.', {
      structuredOutput: {
        schema: sentinelSchema,
        model: createStructuredOutputModel({ __mastra23798Sentinel: 'ok' }) as LanguageModelV2,
        jsonPromptInjection: 'system',
        instructions: INSTRUCTIONS,
      },
    });

    // The finish step runs a separate structuring pass (#26431), which needs these
    // instructions; the main model is not asked for JSON, so they are never injected there.
    const so = (result.workflowInput as any).options.structuredOutput;
    expect(so.hasStructuringModel).toBe(true);
    expect(so.instructions).toBe(INSTRUCTIONS);
  });

  it('injects compact instructions instead of the schema dump on a durable run (system mode)', async () => {
    const promptJson = await runDurable(
      { schema: sentinelSchema, jsonPromptInjection: 'system', instructions: INSTRUCTIONS },
      'durable-instructions-system',
    );

    // Pin the join shape, not just containment: the durable path must produce the same
    // "<agent instructions>\n\n<compact text>" system message the in-process path pins.
    expect(promptJson).toContain(`\\n\\n${INSTRUCTIONS}`);
    expect(promptJson).not.toContain(INLINE_SCHEMA_PREFIX);
    expect(promptJson).not.toContain(SYSTEM_SCHEMA_PREFIX);
    expect(promptJson).not.toContain(SENTINEL);
  });

  it('injects compact instructions instead of the schema dump on a durable run (inline mode)', async () => {
    const promptJson = await runDurable(
      { schema: sentinelSchema, jsonPromptInjection: 'inline', instructions: INSTRUCTIONS },
      'durable-instructions-inline',
    );

    expect(promptJson).toContain(INSTRUCTIONS);
    expect(promptJson).not.toContain(INLINE_SCHEMA_PREFIX);
    expect(promptJson).not.toContain(SYSTEM_SCHEMA_PREFIX);
    expect(promptJson).not.toContain(SENTINEL);
  });

  it('keeps the generated schema instruction on a durable run without instructions', async () => {
    const baseAgent = new Agent({
      id: 'durable-no-instructions-serialization',
      name: 'Durable No Instructions',
      instructions: 'Test serialization',
      model: createStructuredOutputModel({ __mastra23798Sentinel: 'ok' }) as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    const prepared = await durableAgent.prepare('Extract now.', {
      structuredOutput: { schema: sentinelSchema, jsonPromptInjection: 'system' },
    });
    expect((prepared.workflowInput as any).options.structuredOutput.instructions).toBeUndefined();

    const promptJson = await runDurable(
      { schema: sentinelSchema, jsonPromptInjection: 'system' },
      'durable-no-instructions-run',
    );
    expect(promptJson).toContain(SYSTEM_SCHEMA_PREFIX);
    expect(promptJson).toContain(SENTINEL);
  });
});
