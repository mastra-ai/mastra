import { embed as embedAi, embedMany as embedManyAi } from 'ai';

import { MockEmbeddingModelV1 } from 'ai/test';

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
  return await embedAi({ model, value, maxRetries });
}

export async function embedMany(
  values: string[],
  {
    maxRetries = 3,
  }: {
    maxRetries?: number;
  } = {},
) {
  return await embedManyAi({
    model,
    values,
    maxRetries,
  });
}
