import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { IMastraLogger } from '../logger';
import { Agent } from './agent';
import type { SerializableStructuredOutputOptions, StructuredOutputOptionsBase } from './types';

describe('Agent structured output call-site types', () => {
  const agent = new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'Test instructions',
    model: 'openai/gpt-5-mini',
  });
  const schema = z.object({ name: z.string() });
  const logger = {} as IMastraLogger;

  describe('agent.generate()', () => {
    it('allows direct-mode common fields', () => {
      const response = agent.generate('prompt', {
        structuredOutput: {
          schema,
          jsonPromptInjection: 'auto',
          errorStrategy: 'fallback',
          fallbackValue: { name: 'default' },
        },
      });

      expectTypeOf(response).resolves.toHaveProperty('object');
    });

    it('allows processor-mode fields with model', () => {
      const response = agent.generate('prompt', {
        structuredOutput: {
          model: 'openai/gpt-5-mini',
          instructions: 'Give me a name',
          useAgent: true,
          logger,
          providerOptions: { openai: { reasoningEffort: 'low' } },
          schema,
          errorStrategy: 'fallback',
          fallbackValue: { name: 'default' },
        },
      });

      expectTypeOf(response).resolves.toHaveProperty('object');
    });

    it('rejects processor-mode fields without model', () => {
      void agent.generate('prompt', {
        // @ts-expect-error instructions requires model
        structuredOutput: { instructions: 'Give me a name', schema },
      });
      void agent.generate('prompt', {
        // @ts-expect-error useAgent requires model
        structuredOutput: { useAgent: true, schema },
      });
      void agent.generate('prompt', {
        // @ts-expect-error logger requires model
        structuredOutput: { logger, schema },
      });
      void agent.generate('prompt', {
        // @ts-expect-error providerOptions requires model
        structuredOutput: { providerOptions: { openai: { reasoningEffort: 'low' } }, schema },
      });
    });

    it('requires fallbackValue for the fallback error strategy', () => {
      void agent.generate('prompt', {
        // @ts-expect-error fallback requires fallbackValue
        structuredOutput: { schema, errorStrategy: 'fallback' },
      });
    });
  });

  describe('agent.stream()', () => {
    it('allows direct mode', () => {
      const response = agent.stream('prompt', {
        structuredOutput: { schema, jsonPromptInjection: 'inline' },
      });

      expectTypeOf(response).resolves.toHaveProperty('object');
    });

    it('allows processor mode', () => {
      const response = agent.stream('prompt', {
        structuredOutput: {
          model: 'openai/gpt-5-mini',
          instructions: 'Give me a name',
          schema,
        },
      });

      expectTypeOf(response).resolves.toHaveProperty('object');
    });

    it('rejects processor-mode fields without model', () => {
      void agent.stream('prompt', {
        // @ts-expect-error instructions requires model
        structuredOutput: { instructions: 'Give me a name', schema },
      });
      void agent.stream('prompt', {
        // @ts-expect-error useAgent requires model
        structuredOutput: { useAgent: true, schema },
      });
      void agent.stream('prompt', {
        // @ts-expect-error logger requires model
        structuredOutput: { logger, schema },
      });
      void agent.stream('prompt', {
        // @ts-expect-error providerOptions requires model
        structuredOutput: { providerOptions: { openai: { reasoningEffort: 'low' } }, schema },
      });
    });
  });

  describe('structured output type compatibility', () => {
    it('preserves the schema-free, permissive public base type', () => {
      const options: StructuredOutputOptionsBase<{ name: string }> = {
        instructions: 'Give me a name',
        useAgent: true,
        logger,
        providerOptions: { openai: { reasoningEffort: 'low' } },
        jsonPromptInjection: 'auto',
        errorStrategy: 'fallback',
        fallbackValue: { name: 'default' },
      };

      expectTypeOf(options.fallbackValue).toEqualTypeOf<{ name: string }>();
    });

    it('supports direct and processor serializable variants', () => {
      const direct: SerializableStructuredOutputOptions<{ name: string }> = {
        schema: { type: 'object' },
        errorStrategy: 'fallback',
        fallbackValue: { name: 'default' },
      };
      const processor: SerializableStructuredOutputOptions<{ name: string }> = {
        model: { providerId: 'openai', modelId: 'gpt-5-mini' },
        schema: { type: 'object' },
        instructions: 'Give me a name',
      };

      void direct;
      void processor;

      // @ts-expect-error processor-only fields require model
      const invalid: SerializableStructuredOutputOptions<{ name: string }> = {
        schema: { type: 'object' },
        instructions: 'Give me a name',
      };
      void invalid;
    });
  });
});
