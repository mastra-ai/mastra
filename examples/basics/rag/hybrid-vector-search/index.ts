import { openai } from '@ai-sdk/openai';
import { PgVector } from '@mastra/pg';
import { embed } from 'ai';

const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);

// Add in your documents, chunking and vector embedding here

// Filter by metadata value
const { embedding } = await embed({
  value: '[Insert query based on document here]',
  model: openai.embedding('text-embedding-3-small'),
});

const result = await pgVector.query({
  indexName: 'embeddings',
  queryVector: embedding,
  topK: 3,
  filter: {
    'path.to.metadata': {
      eq: 'value',
    },
  },
});

console.log('Results:', result);
