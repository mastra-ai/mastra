import { describe, expect, expectTypeOf, it } from 'vitest';
import type { SerializedMemoryConfig, TitleGenerationConfig } from './types';

describe('SerializedMemoryConfig generateTitle', () => {
  it('accepts the full serialized title generation contract', () => {
    // model is optional: the agent's own model is the default
    const config: SerializedMemoryConfig = {
      options: {
        generateTitle: {
          minMessages: 2,
          emitEvent: true,
        },
      },
    };

    expect(config.options?.generateTitle).toEqual({ minMessages: 2, emitEvent: true });

    const withModel: SerializedMemoryConfig = {
      options: {
        generateTitle: {
          model: 'openai/gpt-4o-mini',
          instructions: 'Generate a concise title',
          minMessages: 2,
          emitEvent: true,
        },
      },
    };

    expect(withModel.options?.generateTitle).toBeDefined();
    expectTypeOf<TitleGenerationConfig>().toExtend<
      boolean | { model?: string; instructions?: string; minMessages?: number; emitEvent?: boolean }
    >();
  });
});
