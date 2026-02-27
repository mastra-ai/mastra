/**
 * Reproduction test for: Structured Output Processor Mode — Silent Failures with Custom Providers
 *
 * Bug: When users call agent.stream() with structuredOutput.model (processor mode) and
 * the inner structuring agent's LLM returns JSON that fails schema validation, the inner
 * agent's createObjectStreamTransformer doesn't know about errorStrategy/fallbackValue
 * (they weren't forwarded). It defaults to 'strict' — emitting an error chunk that
 * propagates up through the inner agent, logging "Error in agent stream" and causing
 * unnecessary error handling in the outer processor.
 *
 * With the fix, errorStrategy/fallbackValue are forwarded so the inner transformer handles
 * the validation error cleanly (e.g., emitting a fallback object-result) without triggering
 * the error path through the inner agent's pipeline.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';

describe('Structured Output Processor Mode — errorStrategy forwarding (repro)', () => {
  // Schema with enum constraint — easy to trigger validation failure
  const colorSchema = z.object({
    color: z.string(),
    intensity: z.enum(['light', 'medium', 'bright', 'vibrant']),
  });

  // Main agent model — returns unstructured text
  let mainModel: MockLanguageModelV2;

  beforeEach(() => {
    mainModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'main-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'The sky is a beautiful shade of blue today.' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Creates a mock model that returns valid JSON but fails schema validation.
   * "very bright" is NOT in the enum ['light', 'medium', 'bright', 'vibrant']
   */
  function createSchemaInvalidModel() {
    return new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'structuring-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: '{"color": "blue", "intensity": "very bright"}' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          },
        ]),
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      }),
    });
  }

  it('should return fallback value when inner agent returns schema-invalid JSON (fallback strategy)', async () => {
    const fallbackValue = { color: 'unknown', intensity: 'medium' as const };

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'Describe colors.',
      model: mainModel,
    });

    const result = await agent.stream('Tell me about the sky color.', {
      structuredOutput: {
        schema: colorSchema,
        model: createSchemaInvalidModel(),
        errorStrategy: 'fallback',
        fallbackValue,
      },
      modelSettings: { maxRetries: 0 },
    });

    const text = await result.text;
    const object = await result.object;

    expect(text).toContain('beautiful shade of blue');
    expect(object).toEqual(fallbackValue);
  }, 30000);

  it('should not log "Error in agent stream" when errorStrategy is forwarded to inner agent', async () => {
    // Spy on console.error to check for "Error in agent stream" from the inner agent
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const fallbackValue = { color: 'unknown', intensity: 'medium' as const };

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'Describe colors.',
      model: mainModel,
    });

    const result = await agent.stream('Tell me about the sky color.', {
      structuredOutput: {
        schema: colorSchema,
        model: createSchemaInvalidModel(),
        errorStrategy: 'fallback',
        fallbackValue,
      },
      modelSettings: { maxRetries: 0 },
    });

    await result.text;
    await result.object;

    // With the fix: errorStrategy='fallback' is forwarded to the inner agent's
    // createObjectStreamTransformer, which emits an object-result with fallbackValue
    // instead of an error chunk. No "Error in agent stream" should be logged.
    const errorCalls = consoleErrorSpy.mock.calls.map(call => String(call[0]));
    const hasAgentStreamError = errorCalls.some(msg => msg.includes('Error in agent stream'));
    expect(hasAgentStreamError).toBe(false);
  }, 30000);

  it('should return structured object when inner agent returns schema-valid JSON', async () => {
    const validModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'structuring-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: '{"color": "blue", "intensity": "bright"}' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          },
        ]),
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      }),
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'Describe colors.',
      model: mainModel,
    });

    const result = await agent.stream('Tell me about the sky color.', {
      structuredOutput: {
        schema: colorSchema,
        model: validModel,
        errorStrategy: 'strict',
      },
      modelSettings: { maxRetries: 0 },
    });

    const text = await result.text;
    const object = await result.object;

    expect(text).toContain('beautiful shade of blue');
    expect(object).toEqual({ color: 'blue', intensity: 'bright' });
  }, 30000);

  it('should return undefined object with warn strategy when validation fails', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'Describe colors.',
      model: mainModel,
    });

    const result = await agent.stream('Tell me about the sky color.', {
      structuredOutput: {
        schema: colorSchema,
        model: createSchemaInvalidModel(),
        errorStrategy: 'warn',
      },
      modelSettings: { maxRetries: 0 },
    });

    const text = await result.text;
    const object = await result.object;

    expect(text).toContain('beautiful shade of blue');
    expect(object).toBeUndefined();
  }, 30000);

  it('should use fallback value when inner model throws entirely', async () => {
    const throwingModel = new MockLanguageModelV2({
      doStream: async () => {
        throw new Error('Provider connection failed');
      },
    });

    const fallbackValue = { color: 'unknown', intensity: 'medium' as const };

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'Describe colors.',
      model: mainModel,
    });

    const result = await agent.stream('Tell me about the sky color.', {
      structuredOutput: {
        schema: colorSchema,
        model: throwingModel,
        errorStrategy: 'fallback',
        fallbackValue,
      },
      modelSettings: { maxRetries: 0 },
    });

    const text = await result.text;
    const object = await result.object;

    expect(text).toContain('beautiful shade of blue');
    expect(object).toEqual(fallbackValue);
  }, 30000);
});
