import { embed } from '@mastra/rag';
import { PgVector } from '@mastra/pg';

const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);

// Add in your documents, chunking and vector embedding here

// Filter by metadata value
const { embedding } = await embed('[Insert query based on document here]', {
  provider: 'OPEN_AI',
  model: 'text-embedding-3-small',
  maxRetries: 3,
});

const result = await pgVector.query('embeddings', embedding, 3, {
  'path.to.metadata': {
    eq: 'value',
  },
});

console.log('Results:', result);
