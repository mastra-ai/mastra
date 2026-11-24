import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel } from '@mastra/core/vector';
import { LibSQLVector } from '@mastra/libsql';
import type { Memory } from '@mastra/memory';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDynamicMemory } from './memory.js';

const DIMENSION = 8;

/** A hosted embedding model stand-in: deterministic bag-of-words vectors, recording every input. */
function createHostedEmbedder() {
  const inputs: string[] = [];
  const embed = (text: string) => {
    const vector = Array.from({ length: DIMENSION }, () => 0);
    for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
      let hash = 0;
      for (const char of word) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
      vector[hash % DIMENSION]! += 1;
    }
    return vector;
  };
  const model: MastraEmbeddingModel<string> = {
    specificationVersion: 'v2',
    provider: 'hosted-test',
    modelId: 'hosted-embedder',
    maxEmbeddingsPerCall: 100,
    supportsParallelCalls: true,
    doEmbed: async ({ values }) => {
      inputs.push(...values);
      return { embeddings: values.map(embed) };
    },
  };
  return { model, inputs };
}

describe('getDynamicMemory with an operator-chosen embedder', () => {
  const vectors: LibSQLVector[] = [];

  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(vectors.splice(0).map(vector => vector.close()));
  });

  it('indexes and recalls observations with the configured embedder instead of local fastembed', async () => {
    const vector = new LibSQLVector({ id: 'embedder-test', url: 'file::memory:' });
    vectors.push(vector);
    const hosted = createHostedEmbedder();

    const memory = getDynamicMemory(new InMemoryStore(), vector, undefined, { embedder: hosted.model })({
      requestContext: new RequestContext(),
    }) as Memory;

    await memory.indexObservation({
      text: 'The deploy target for the billing service is staging',
      groupId: 'group-1',
      range: 'message-1:message-2',
      threadId: 'thread-1',
      resourceId: 'resource-1',
    });
    const { results } = await memory.searchMessages({ query: 'billing deploy target', resourceId: 'resource-1' });

    expect(results.map(result => result.groupId)).toEqual(['group-1']);
    expect(hosted.inputs).toEqual(
      expect.arrayContaining(['The deploy target for the billing service is staging', 'billing deploy target']),
    );
    // Vectors land in the chosen model's dimension, not fastembed's 384.
    expect(await vector.listIndexes()).toEqual([`memory_observations_${DIMENSION}`]);
  });

  it('fails when the memory is built, not at the first recall, if a router embedder has no API key', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const vector = new LibSQLVector({ id: 'embedder-missing-key', url: 'file::memory:' });
    vectors.push(vector);

    expect(() =>
      getDynamicMemory(new InMemoryStore(), vector, undefined, { embedder: 'openai/text-embedding-3-small' }),
    ).toThrow(/API key not found for provider openai/);
  });

  it('accepts a Mastra gateway embedder id and checks its key when the memory is built', () => {
    const vector = new LibSQLVector({ id: 'embedder-gateway', url: 'file::memory:' });
    vectors.push(vector);

    vi.stubEnv('MASTRA_GATEWAY_API_KEY', '');
    expect(() =>
      getDynamicMemory(new InMemoryStore(), vector, undefined, { embedder: 'mastra/openai/text-embedding-3-small' }),
    ).toThrow(/API key not found for provider mastra/);

    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'gateway-key');
    const memory = getDynamicMemory(new InMemoryStore(), vector, undefined, {
      embedder: 'mastra/openai/text-embedding-3-small',
    })({ requestContext: new RequestContext() }) as Memory;
    expect(memory.embedder).toMatchObject({ provider: 'mastra', modelId: 'openai/text-embedding-3-small' });
  });
});
