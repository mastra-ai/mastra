import { embed as embedAi, embedMany as embedManyAi, EmbedResult, EmbedManyResult } from 'ai';

import { MockEmbeddingModelV1 } from 'ai/test';

import { MastraEmbedder } from './embedder';

const model = new MockEmbeddingModelV1({
  doEmbed: () => Promise.resolve({ embeddings: [[1, 0]] }),
});

export async function embed(
  value: string,
  {
    maxRetries = 3,
  }: {
    maxRetries?: number;
  } = {},
) {
  return await embedAi<string>({ model, value, maxRetries });
}

export async function embedMany(
  values: string[],
  {
    maxRetries = 3,
  }: {
    maxRetries?: number;
  } = {},
) {
  return await embedManyAi<string>({
    model,
    values,
    maxRetries,
  });
}

export class MockEmbedder extends MastraEmbedder {
  constructor() {
    super();
  }

  async embed(
    value: string,
    { maxRetries }: { maxRetries?: number } = { maxRetries: 3 },
  ): Promise<EmbedResult<string>> {
    return embed(value, {
      maxRetries,
    });
  }

  async embedMany(
    values: string[],
    { maxRetries }: { maxRetries?: number } = { maxRetries: 3 },
  ): Promise<EmbedManyResult<string>> {
    return embedMany(values, {
      maxRetries,
    });
  }
}
