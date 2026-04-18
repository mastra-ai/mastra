import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { IMastraLogger } from '../logger';
import type { PublicStructuredOutputOptions } from './types';

describe('Agent Structured Output Type Tests', () => {
  it('should allow schema only (Direct Mode)', () => {
    const options: PublicStructuredOutputOptions<{ name: string }> = {
      schema: z.object({ name: z.string() }),
    };
    expectTypeOf(options).toBeObject();
  });

  it('should allow model and instructions (Processor Mode)', () => {
    const options: PublicStructuredOutputOptions<{ name: string }> = {
      model: 'openai/gpt-4o',
      instructions: 'Give me a name',
      schema: z.object({ name: z.string() }),
    };
    expectTypeOf(options).toBeObject();
  });

  it('should allow common fields in both modes', () => {
    const directOptions: PublicStructuredOutputOptions<{ name: string }> = {
      schema: z.object({ name: z.string() }),
      jsonPromptInjection: true,
    };

    const processorOptions: PublicStructuredOutputOptions<{ name: string }> = {
      model: 'openai/gpt-4o',
      schema: z.object({ name: z.string() }),
      jsonPromptInjection: true,
    };

    expectTypeOf(directOptions).toBeObject();
    expectTypeOf(processorOptions).toBeObject();
  });

  // Negative cases: processor-only fields must be rejected when `model` is missing
  it('should NOT allow processor fields without model', () => {
    // @ts-expect-error - instructions requires model
    const _opt1: PublicStructuredOutputOptions<{ name: string }> = {
      instructions: 'Give me a name',
      schema: z.object({ name: z.string() }),
    };

    // @ts-expect-error - logger requires model
    const _opt2: PublicStructuredOutputOptions<{ name: string }> = {
      logger: {} as unknown as IMastraLogger,
      schema: z.object({ name: z.string() }),
    };

    // @ts-expect-error - providerOptions requires model
    const _opt3: PublicStructuredOutputOptions<{ name: string }> = {
      providerOptions: { openai: { reasoningEffort: 'low' } },
      schema: z.object({ name: z.string() }),
    };

    // @ts-expect-error - errorStrategy requires model
    const _opt4: PublicStructuredOutputOptions<{ name: string }> = {
      errorStrategy: 'warn',
      schema: z.object({ name: z.string() }),
    };

    // @ts-expect-error - fallbackValue requires model
    const _opt5: PublicStructuredOutputOptions<{ name: string }> = {
      errorStrategy: 'fallback',
      fallbackValue: { name: 'default' },
      schema: z.object({ name: z.string() }),
    };
  });

  it('should allow fallback fields in Processor Mode', () => {
    const options: PublicStructuredOutputOptions<{ name: string }> = {
      model: 'openai/gpt-4o',
      schema: z.object({ name: z.string() }),
      errorStrategy: 'fallback',
      fallbackValue: { name: 'default' },
    };
    expectTypeOf(options).toBeObject();
  });
});
