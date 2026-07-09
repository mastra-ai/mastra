import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: structured output validation failure surfacing.
 *
 * When the model returns JSON that violates the schema, the loop surfaces an
 * `error` chunk carrying the validation message rather than resolving an
 * invalid object. When the model returns schema-valid JSON, the object stream
 * assembles and parses it. These tests pin both paths.
 *
 * (The AIMock fixture returns each response body as a single block, so this
 * file cannot script a genuinely *partial/torn* JSON stream that is later
 * repaired mid-flight; that streaming-assembly edge is covered by the
 * output-format-handlers unit tests.)
 */
describeForAllEngines('AIMock loop scenario: structured output validation surfacing', engine => {
  const getMock = useLoopScenarioAimock();

  it('reports validation failure with detailed error information', async () => {
    const schema = z.object({
      name: z.string().min(3),
      age: z.number().positive(),
    });

    const { chunks, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Extract user data.',
      stopWhen: stepCountIs(1),
      structuredOutput: { schema },
      collectChunks: true,
      fixtures: llm => {
        // Return invalid JSON (name too short)
        llm.on({ endpoint: 'chat' }, { content: '{"name":"Jo","age":25}' });
      },
    });

    // Exactly one model request (single-step structured output).
    expect(requests).toHaveLength(1);

    // The schema-invalid response surfaces an error chunk with a validation message.
    const errorChunks = chunks?.filter(c => c?.type === 'error') ?? [];
    expect(errorChunks.length).toBeGreaterThan(0);

    const errorMessage = (errorChunks[0]?.payload?.error as Error)?.message || '';
    expect(errorMessage).toContain('validation');
  });

  it('propagates error when max retries exhausted with invalid output', async () => {
    const schema = z.object({
      count: z.number().min(0),
    });

    const { chunks, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Get a count.',
      stopWhen: stepCountIs(2),
      structuredOutput: { schema },
      collectChunks: true,
      fixtures: llm => {
        // Always return invalid (negative count)
        llm.on({ endpoint: 'chat' }, { content: '{"count":-1}' });
      },
    });

    // Invalid output surfaces a validation error chunk on every attempt.
    const errorChunks = chunks?.filter(c => c?.type === 'error') ?? [];
    expect(errorChunks.length).toBeGreaterThan(0);

    const errorMessage = (errorChunks[0]?.payload?.error as Error)?.message || '';
    expect(errorMessage).toContain('validation');

    expect(requests!.length).toBeGreaterThanOrEqual(1);
  });

  it('assembles and parses schema-valid streamed JSON', async () => {
    const schema = z.object({
      items: z.array(z.string()),
    });

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'List some items.',
      stopWhen: stepCountIs(1),
      structuredOutput: { schema },
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: '{"items":["apple","banana","cherry"]}' });
      },
    });

    // The streamed JSON assembles into the exact schema-valid object.
    const object = await (output as unknown as { object: Promise<unknown> }).object;
    expect(object).toEqual({
      items: ['apple', 'banana', 'cherry'],
    });
  });
});
