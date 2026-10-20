import { createOpenAI as createOpenAIV1 } from '@ai-sdk/openai';
import { createOpenAI as createOpenAIV2 } from '@ai-sdk/openai-v5';
import { createOpenAI as createOpenAIV3 } from '@ai-sdk/openai-v6';
import { createOpenAI as createOpenAIV4 } from '@ai-sdk/openai-v7';
import { describe, expectTypeOf, it } from 'vitest';
import type { embedV4, MastraEmbeddingModel, MastraEmbeddingOptions, MastraSupportedEmbeddingModel } from './index';

describe('Public embedding model compatibility', () => {
  it('accepts concrete provider models without casts', () => {
    const legacy = createOpenAIV1().embedding('text-embedding-3-small');
    const v2 = createOpenAIV2().embedding('text-embedding-3-small');
    const v3 = createOpenAIV3().embedding('text-embedding-3-small');
    const v4 = createOpenAIV4().embedding('text-embedding-3-small');

    expectTypeOf(legacy).toExtend<MastraEmbeddingModel<string>>();
    expectTypeOf(v2).toExtend<MastraSupportedEmbeddingModel<string>>();
    expectTypeOf(v3).toExtend<MastraSupportedEmbeddingModel<string>>();
    expectTypeOf(v4).toExtend<MastraSupportedEmbeddingModel<string>>();
    expectTypeOf(v4).toExtend<MastraEmbeddingModel<string>>();
    expectTypeOf(v4).toExtend<Parameters<typeof embedV4>[0]['model']>();
    expectTypeOf<Parameters<typeof embedV4>[0]['providerOptions']>().toExtend<
      MastraEmbeddingOptions['providerOptions']
    >();
    expectTypeOf<Parameters<typeof embedV4>[0]['telemetry']>().toExtend<MastraEmbeddingOptions['telemetry']>();
  });
});
