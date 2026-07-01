import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { Agent } from './agent';
import { tryGenerateWithJsonFallback } from './utils';

/**
 * The fallback helper only ever calls `agent.generate(prompt, options)`, so a
 * duck-typed stub is sufficient. We assert both *when* it retries (thrown error
 * or undefined object) and that the retry flips on `jsonPromptInjection`.
 */
function makeAgent(generate: ReturnType<typeof vi.fn>): Agent {
  return { generate } as unknown as Agent;
}

const baseOptions = {
  structuredOutput: { schema: z.object({ decision: z.string() }) },
} as any;

describe('tryGenerateWithJsonFallback', () => {
  it('returns the first result without retrying when it has a valid object', async () => {
    const generate = vi.fn().mockResolvedValue({ object: { decision: 'done' } });
    const result = await tryGenerateWithJsonFallback(makeAgent(generate), 'prompt', baseOptions);

    expect(result).toEqual({ object: { decision: 'done' } });
    expect(generate).toHaveBeenCalledTimes(1);
    // No jsonPromptInjection flip on the (only) call.
    expect(generate.mock.calls[0][1].structuredOutput.jsonPromptInjection).toBeUndefined();
  });

  it('retries with jsonPromptInjection when the first generate throws', async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error('model exploded'))
      .mockResolvedValueOnce({ object: { decision: 'continue' } });

    const result = await tryGenerateWithJsonFallback(makeAgent(generate), 'prompt', baseOptions);

    expect(result).toEqual({ object: { decision: 'continue' } });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1][1].structuredOutput.jsonPromptInjection).toBe(true);
  });

  it('retries with jsonPromptInjection when the first generate resolves with no object', async () => {
    // The key gap this closes: a model can resolve *without throwing* but produce
    // no parseable structured object. Without the guard the caller reads
    // `result.object` and crashes instead of getting the retry.
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ object: undefined })
      .mockResolvedValueOnce({ object: { decision: 'done' } });

    const result = await tryGenerateWithJsonFallback(makeAgent(generate), 'prompt', baseOptions);

    expect(result).toEqual({ object: { decision: 'done' } });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1][1].structuredOutput.jsonPromptInjection).toBe(true);
  });

  it('preserves explicit inline jsonPromptInjection on the retry', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ object: undefined })
      .mockResolvedValueOnce({ object: { decision: 'done' } });

    const options = {
      structuredOutput: { schema: z.object({ decision: z.string() }), jsonPromptInjection: 'inline' },
    } as any;

    await tryGenerateWithJsonFallback(makeAgent(generate), 'prompt', options);

    expect(generate.mock.calls[1][1].structuredOutput.jsonPromptInjection).toBe('inline');
  });

  it('preserves explicit system jsonPromptInjection on the retry', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ object: undefined })
      .mockResolvedValueOnce({ object: { decision: 'done' } });

    const options = {
      structuredOutput: { schema: z.object({ decision: z.string() }), jsonPromptInjection: 'system' },
    } as any;

    await tryGenerateWithJsonFallback(makeAgent(generate), 'prompt', options);

    expect(generate.mock.calls[1][1].structuredOutput.jsonPromptInjection).toBe('system');
  });

  it('preserves the rest of the options on the retry', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ object: undefined })
      .mockResolvedValueOnce({ object: { decision: 'done' } });

    const options = {
      structuredOutput: { schema: z.object({ decision: z.string() }), jsonPromptInjection: false },
      telemetry: { marker: 'keep-me' },
    } as any;

    await tryGenerateWithJsonFallback(makeAgent(generate), 'prompt', options);

    const retryOptions = generate.mock.calls[1][1];
    expect(retryOptions.telemetry).toEqual({ marker: 'keep-me' });
    expect(retryOptions.structuredOutput.jsonPromptInjection).toBe(true);
  });

  it('throws when structuredOutput.schema is missing', async () => {
    const generate = vi.fn();
    await expect(
      tryGenerateWithJsonFallback(makeAgent(generate), 'prompt', { structuredOutput: {} } as any),
    ).rejects.toThrow(/structuredOutput is required/);
    expect(generate).not.toHaveBeenCalled();
  });
});
