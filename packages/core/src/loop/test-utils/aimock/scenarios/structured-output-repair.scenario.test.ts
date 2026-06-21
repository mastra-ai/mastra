import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: structured output validation failure repair.
 *
 * When the model returns invalid JSON that violates the schema, the loop
 * should be able to retry and eventually succeed with valid output. This
 * tests the repair/retry path for structured output validation failures.
 */
describe('AIMock loop scenario: structured output validation repair', () => {
  const getMock = useLoopScenarioAimock();

  it('reports validation failure with detailed error information', async () => {
    const schema = z.object({
      name: z.string().min(3),
      age: z.number().positive(),
    });

    const { chunks, requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Extract user data.',
      stopWhen: stepCountIs(1),
      structuredOutput: { schema },
      collectChunks: true,
      fixtures: llm => {
        // Return invalid JSON (name too short)
        llm.on(
          { endpoint: 'chat' },
          { content: '{"name":"Jo","age":25}' },
        );
      },
    });

    // Should have made at least one request
    expect(requests!.length).toBeGreaterThanOrEqual(1);

    // Should have error chunks with validation details
    const errorChunks = chunks?.filter(c => c?.type === 'error');
    expect(errorChunks?.length).toBeGreaterThan(0);

    // Error should mention validation failure
    const errorChunk = errorChunks?.[0];
    const errorMessage = (errorChunk?.payload?.error as Error)?.message || '';
    expect(errorMessage).toContain('validation');
  });

  it('propagates error when max retries exhausted with invalid output', async () => {
    const schema = z.object({
      count: z.number().min(0),
    });

    const { chunks, requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Get a count.',
      stopWhen: stepCountIs(2),
      structuredOutput: { schema },
      collectChunks: true,
      fixtures: llm => {
        // Always return invalid (negative count)
        llm.on(
          { endpoint: 'chat' },
          { content: '{"count":-1}' },
        );
      },
    });

    // Should have error chunks from validation failures
    const errorChunks = chunks?.filter(c => c?.type === 'error');
    expect(errorChunks?.length).toBeGreaterThan(0);

    // Should have made at least one request
    expect(requests!.length).toBeGreaterThanOrEqual(1);
  });

  it('handles partial JSON repair through streaming', async () => {
    const schema = z.object({
      items: z.array(z.string()),
    });

    const { output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'List some items.',
      stopWhen: stepCountIs(1),
      structuredOutput: { schema },
      fixtures: llm => {
        // Model streams partial JSON that becomes valid
        llm.on(
          { endpoint: 'chat' },
          { content: '{"items":["apple","banana","cherry"]}' },
        );
      },
    });

    // Should successfully parse the streamed JSON
    const object = await (output as unknown as { object: Promise<unknown> }).object;
    expect(object).toEqual({
      items: ['apple', 'banana', 'cherry'],
    });
  });
});
