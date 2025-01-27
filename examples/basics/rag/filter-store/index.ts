import { EmbedManyResult } from '@mastra/core';
import { embed, MDocument } from '@mastra/rag';
import { PgVector } from '@mastra/vector-pg';

const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);

const doc = MDocument.fromText(`Movies Review Guide

Action Movies
Fast cars and explosions are common in action films. The latest action movies use a lot of special effects.

Comedy Movies
Comedy films make people laugh. Recent comedies often mix humor with other genres.

Horror Movies
Horror films are designed to scare viewers. Modern horror relies heavily on suspense.`);

const chunks = await doc.chunk({
  strategy: 'recursive',
  size: 128,
  overlap: 20,
  separator: '\n',
  extract: {
    keywords: true,
  },
});

const { embeddings } = (await embed(chunks, {
  provider: 'OPEN_AI',
  model: 'text-embedding-ada-002',
  maxRetries: 3,
})) as EmbedManyResult<string>;

await pgVector.createIndex('embeddings', 1536);
await pgVector.upsert(
  'embeddings',
  embeddings,
  chunks?.map((chunk: any, index: number) => ({
    text: chunk.text,
    ...chunk.metadata,
    metadata: {
      genre: chunk.text.toLowerCase().includes('action')
        ? 'action'
        : chunk.text.toLowerCase().includes('comedy')
          ? 'comedy'
          : 'horror',
      id: index,
    },
  })),
);

// Filter by genre
const { embedding } = await embed('Tell me about action movies', {
  provider: 'OPEN_AI',
  model: 'text-embedding-ada-002',
  maxRetries: 3,
});

const result = await pgVector.query('embeddings', embedding, 3, {
  'metadata.genre': {
    eq: 'action',
  },
});

console.log('Action movies results:', result);

// Filter by document section (using ID)
const { embedding: embedding2 } = await embed('Show me later sections', {
  provider: 'OPEN_AI',
  model: 'text-embedding-ada-002',
  maxRetries: 3,
});

const result2 = await pgVector.query('embeddings', embedding2, 3, {
  'metadata.id': {
    gt: 1,
  },
});

console.log('Later sections results:', result2);
