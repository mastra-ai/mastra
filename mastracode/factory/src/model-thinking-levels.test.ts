import { MODEL_THINKING_LEVELS } from '@internal/factory-contract';
import type { ModelThinkingLevel } from '@internal/factory-contract';
import { THINKING_LEVEL_VALUES } from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { describe, expect, expectTypeOf, it } from 'vitest';

describe('when model packs name thinking levels', () => {
  it('offers the same levels as the code SDK', () => {
    expect([...MODEL_THINKING_LEVELS]).toEqual(THINKING_LEVEL_VALUES);
    expectTypeOf<ModelThinkingLevel>().toEqualTypeOf<ThinkingLevelSetting>();
  });
});
