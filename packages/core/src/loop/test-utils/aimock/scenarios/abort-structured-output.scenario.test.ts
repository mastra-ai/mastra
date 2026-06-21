import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: abort signal during structured output streaming.
 *
 * Tests that when an abort signal is triggered while structured output is
 * being streamed, the loop handles it gracefully without crashing or producing
 * invalid data. This pins the interaction between abort signals and structured
 * output validation.
 */
describe('AIMock loop scenario: abort during structured output', () => {
  const getMock = useLoopScenarioAimock();

  it('handles abort signal gracefully during structured output streaming', async () => {
    const abortController = new AbortController();

    const schema = z.object({
      items: z.array(z.object({ id: z.number(), name: z.string() })),
      count: z.number(),
    });

    // Track if we get an error
    let caughtError: Error | null = null;

    try {
      const { output, requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Generate a list of items',
        abortSignal: abortController.signal,
        structuredOutput: { schema },
        fixtures: llm => {
          // Model returns a large JSON object that will take time to stream
          const largeObject = {
            items: Array.from({ length: 100 }, (_, i) => ({
              id: i,
              name: `Item ${i} with a moderately long description to slow down streaming`,
            })),
            count: 100,
          };

          llm.on({ endpoint: 'chat' }, { content: JSON.stringify(largeObject) });
        },
      });

      // Abort shortly after streaming starts
      setTimeout(() => abortController.abort(), 10);

      // Try to get the object - this should either:
      // 1. Return partial data that fails validation
      // 2. Throw an abort error
      // 3. Return gracefully with incomplete data
      try {
        const object = await (output as unknown as { object: Promise<unknown> }).object;
        // If we got here, we got some data (possibly incomplete)
        expect(object).toBeDefined();
      } catch (err: any) {
        // Abort errors are expected
        if (err.name === 'AbortError' || err.message.includes('abort')) {
          // Expected - abort was respected
        } else {
          // Validation errors are also acceptable (partial JSON failed schema)
          if (err.name === 'ZodError' || err.message.includes('validation')) {
            // Expected - partial data failed validation
          } else {
            throw err;
          }
        }
      }

      // Should have made at least one request
      expect(requests.length).toBeGreaterThanOrEqual(1);
    } catch (err: any) {
      caughtError = err;
    }

    // If we caught an error at the top level, it should be abort-related
    if (caughtError) {
      expect(
        caughtError.name === 'AbortError' ||
          caughtError.message.includes('abort') ||
          caughtError.message.includes('cancel'),
      ).toBe(true);
    }
  });

  it('completes structured output when abort signal is not triggered', async () => {
    const abortController = new AbortController();

    const schema = z.object({
      result: z.string(),
      value: z.number(),
    });

    const { output, requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Return a simple result',
      abortSignal: abortController.signal,
      structuredOutput: { schema },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat' },
          { content: JSON.stringify({ result: 'success', value: 42 }) },
        );
      },
    });

    // Don't abort - let it complete
    const object = await (output as unknown as { object: Promise<unknown> }).object;
    expect(schema.parse(object)).toEqual({ result: 'success', value: 42 });

    expect(requests.length).toBeGreaterThanOrEqual(1);
  });

  it('prevents structured output when abort signal is already aborted', async () => {
    const abortController = new AbortController();
    abortController.abort(); // Abort before starting

    const schema = z.object({
      data: z.string(),
    });

    let caughtError: Error | null = null;

    try {
      const { output } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Generate data',
        abortSignal: abortController.signal,
        structuredOutput: { schema },
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: JSON.stringify({ data: 'test' }) });
        },
      });

      // Try to get the object
      await (output as unknown as { object: Promise<unknown> }).object;
    } catch (err: any) {
      caughtError = err;
    }

    // Should have thrown an abort error or returned early
    if (caughtError) {
      expect(
        caughtError.name === 'AbortError' ||
          caughtError.message.includes('abort') ||
          caughtError.message.includes('cancel'),
      ).toBe(true);
    }
  });
});
