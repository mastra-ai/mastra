import { Mastra } from '@mastra/core/mastra';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { DuckDBVector } from '@mastra/duckdb';
import { z } from 'zod';

const nativeStep = createStep({
  id: 'native-step',
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({ topMatch: z.string().nullable(), matchCount: z.number() }),
  execute: async ({ mastra }) => {
    const vector = mastra?.getVector('duckdb');
    if (!vector) throw new Error('duckdb vector store is not configured');
    await vector.createIndex({ indexName: 'native_vectors', dimension: 3 });
    await vector.upsert({
      indexName: 'native_vectors',
      vectors: [
        [1, 0, 0],
        [0, 1, 0],
      ],
      ids: ['vec-native-a', 'vec-native-b'],
    });
    const matches = await vector.query({ indexName: 'native_vectors', queryVector: [1, 0, 0], topK: 1 });
    return { topMatch: matches[0]?.id ?? null, matchCount: matches.length };
  },
});

const nativeWorkflow = createWorkflow({
  id: 'native-workflow',
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({ topMatch: z.string().nullable(), matchCount: z.number() }),
})
  .then(nativeStep)
  .commit();

console.error('native experiment fixture initialized');

export const mastra = new Mastra({
  workflows: { nativeWorkflow },
  vectors: { duckdb: new DuckDBVector({ id: 'native-vector', path: ':memory:', dimensions: 3 }) },
  bundler: { externals: ['@duckdb/node-bindings', '@duckdb/node-api'] },
});
