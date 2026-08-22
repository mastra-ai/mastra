import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { IMastraLogger } from '../logger';
import { Agent } from './agent';

describe('Agent Structured Output Call-Site Type Tests', () => {
  const agent = new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'Test instructions',
    model: 'openai/gpt-4o',
  });

  const schema = z.object({ name: z.string() });

  describe('agent.generate()', () => {
    it('should allow schema only (Direct Mode)', () => {
      const res = agent.generate('prompt', {
        structuredOutput: {
          schema,
        },
      });
      expectTypeOf(res).resolves.toHaveProperty('object');
    });

    it('should allow model and instructions (Processor Mode)', () => {
      const res = agent.generate('prompt', {
        structuredOutput: {
          model: 'openai/gpt-4o',
          instructions: 'Give me a name',
          schema,
        },
      });
      expectTypeOf(res).resolves.toHaveProperty('object');
    });

    it('should allow errorStrategy and fallbackValue in Direct Mode (Common Fields)', () => {
      const res1 = agent.generate('prompt', {
        structuredOutput: {
          schema,
          errorStrategy: 'warn',
        },
      });
      const res2 = agent.generate('prompt', {
        structuredOutput: {
          schema,
          errorStrategy: 'fallback',
          fallbackValue: { name: 'default' },
        },
      });
      expectTypeOf(res1).resolves.toHaveProperty('object');
      expectTypeOf(res2).resolves.toHaveProperty('object');
    });

    it('should allow errorStrategy and fallbackValue in Processor Mode', () => {
      const res = agent.generate('prompt', {
        structuredOutput: {
          model: 'openai/gpt-4o',
          schema,
          errorStrategy: 'fallback',
          fallbackValue: { name: 'default' },
        },
      });
      expectTypeOf(res).resolves.toHaveProperty('object');
    });

    it('should NOT allow processor-only fields without model', () => {
      void agent.generate('prompt', {
        // @ts-expect-error - instructions requires model
        structuredOutput: {
          instructions: 'Give me a name',
          schema,
        },
      });

      void agent.generate('prompt', {
        // @ts-expect-error - logger requires model
        structuredOutput: {
          logger: {} as unknown as IMastraLogger,
          schema,
        },
      });

      void agent.generate('prompt', {
        // @ts-expect-error - providerOptions requires model
        structuredOutput: {
          providerOptions: { openai: { reasoningEffort: 'low' } },
          schema,
        },
      });

      void agent.generate('prompt', {
        // @ts-expect-error - useAgent requires model
        structuredOutput: {
          useAgent: true,
          schema,
        },
      });
    });
  });

  describe('agent.stream()', () => {
    it('should allow schema only (Direct Mode)', () => {
      const res = agent.stream('prompt', {
        structuredOutput: {
          schema,
        },
      });
      expectTypeOf(res).resolves.toHaveProperty('object');
    });

    it('should allow model and instructions (Processor Mode)', () => {
      const res = agent.stream('prompt', {
        structuredOutput: {
          model: 'openai/gpt-4o',
          instructions: 'Give me a name',
          schema,
        },
      });
      expectTypeOf(res).resolves.toHaveProperty('object');
    });

    it('should allow errorStrategy and fallbackValue in Direct Mode (Common Fields)', () => {
      const res1 = agent.stream('prompt', {
        structuredOutput: {
          schema,
          errorStrategy: 'warn',
        },
      });
      const res2 = agent.stream('prompt', {
        structuredOutput: {
          schema,
          errorStrategy: 'fallback',
          fallbackValue: { name: 'default' },
        },
      });
      expectTypeOf(res1).resolves.toHaveProperty('object');
      expectTypeOf(res2).resolves.toHaveProperty('object');
    });

    it('should allow errorStrategy and fallbackValue in Processor Mode', () => {
      const res = agent.stream('prompt', {
        structuredOutput: {
          model: 'openai/gpt-4o',
          schema,
          errorStrategy: 'fallback',
          fallbackValue: { name: 'default' },
        },
      });
      expectTypeOf(res).resolves.toHaveProperty('object');
    });

    it('should NOT allow processor-only fields without model', () => {
      void agent.stream('prompt', {
        // @ts-expect-error - instructions requires model
        structuredOutput: {
          instructions: 'Give me a name',
          schema,
        },
      });

      void agent.stream('prompt', {
        // @ts-expect-error - logger requires model
        structuredOutput: {
          logger: {} as unknown as IMastraLogger,
          schema,
        },
      });

      void agent.stream('prompt', {
        // @ts-expect-error - providerOptions requires model
        structuredOutput: {
          providerOptions: { openai: { reasoningEffort: 'low' } },
          schema,
        },
      });

      void agent.stream('prompt', {
        // @ts-expect-error - useAgent requires model
        structuredOutput: {
          useAgent: true,
          schema,
        },
      });
    });
  });
});
