import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: structured output error strategies.
 *
 * Tests that when schema validation fails, the configured errorStrategy
 * (strict, warn, fallback) is correctly applied.
 *
 * This prevents regressions in structured output error handling.
 */
describeForAllEngines('AIMock loop scenario: structured output error strategies', engine => {
  const getMock = useLoopScenarioAimock();

  it('strict strategy (default) emits error chunk on validation failure', async () => {
    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Generate invalid data',
      collectChunks: true,
      structuredOutput: {
        schema: z.object({
          name: z.string(),
          age: z.number(),
        }),
        // errorStrategy defaults to 'strict'
      },
      fixtures: llm => {
        // Model returns invalid JSON (missing required field)
        llm.on(
          { endpoint: 'chat' },
          {
            content: '{"name": "Alice"}', // Missing 'age' field
          },
        );
      },
    });

    // Should emit error chunk
    const errorChunk = chunks?.find((c: any) => c?.type === 'error');
    expect(errorChunk).toBeDefined();
    expect((errorChunk as any)?.payload?.error?.message).toContain('validation failed');
  });

  it('fallback strategy returns fallbackValue on validation failure', async () => {
    const fallbackData = {
      name: 'Default Name',
      age: 0,
    };

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Generate invalid data',
      collectChunks: true,
      structuredOutput: {
        schema: z.object({
          name: z.string(),
          age: z.number(),
        }),
        errorStrategy: 'fallback',
        fallbackValue: fallbackData,
      },
      fixtures: llm => {
        // Model returns invalid JSON
        llm.on(
          { endpoint: 'chat' },
          {
            content: '{"name": "Alice"}', // Missing 'age' field
          },
        );
      },
    });

    // Should emit object-result with fallback value
    const objectResultChunk = chunks?.find((c: any) => c?.type === 'object-result');
    expect(objectResultChunk).toBeDefined();
    expect((objectResultChunk as any)?.object).toEqual(fallbackData);

    // Should NOT emit error chunk
    const errorChunk = chunks?.find((c: any) => c?.type === 'error');
    expect(errorChunk).toBeUndefined();
  });

  it('warn strategy logs warning and does not emit error chunk on validation failure', async () => {
    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Generate invalid data',
      collectChunks: true,
      structuredOutput: {
        schema: z.object({
          name: z.string(),
          age: z.number(),
        }),
        errorStrategy: 'warn',
      },
      fixtures: llm => {
        // Model returns partially valid JSON
        llm.on(
          { endpoint: 'chat' },
          {
            content: '{"name": "Alice", "age": "not-a-number"}',
          },
        );
      },
    });

    // Should NOT emit error chunk
    const errorChunk = chunks?.find((c: any) => c?.type === 'error');
    expect(errorChunk).toBeUndefined();

    // Should NOT emit object-result chunk either (just logs warning)
    const objectResultChunk = chunks?.find((c: any) => c?.type === 'object-result');
    expect(objectResultChunk).toBeUndefined();
  });

  it('strict strategy succeeds when validation passes', async () => {
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Generate valid data',
      structuredOutput: {
        schema: z.object({
          name: z.string(),
          age: z.number(),
        }),
        errorStrategy: 'strict',
      },
      fixtures: llm => {
        // Model returns valid JSON
        llm.on(
          { endpoint: 'chat' },
          {
            content: '{"name": "Alice", "age": 30}',
          },
        );
      },
    });

    // Should return parsed object
    const object = await (output as unknown as { object: Promise<unknown> }).object;
    expect(object).toEqual({
      name: 'Alice',
      age: 30,
    });
  });
});
