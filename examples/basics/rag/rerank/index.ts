import { openai } from '@ai-sdk/openai';
import { PgVector } from '@mastra/pg';
import { MDocument, rerank } from '@mastra/rag';
import { embedMany, embed } from 'ai';

// Create a document and process it into chunks
const doc1 = MDocument.fromText(`
market data shows price resistance levels.
technical charts display moving averages.
support levels guide trading decisions.
breakout patterns signal entry points.
price action determines trade timing.

baseball cards show gradual value increase.
rookie cards command premium prices.
card condition affects resale value.
authentication prevents fake trading.
grading services verify card quality.

volume analysis confirms price trends.
sports cards track seasonal demand.
chart patterns predict movements.
mint condition doubles card worth.
resistance breaks trigger orders.
rare cards appreciate yearly.
`);

const chunks = await doc1.chunk({
  strategy: 'recursive',
  size: 150,
  overlap: 20,
  separator: '\n',
});

// Generate embeddings for the chunks
const { embeddings } = await embedMany({
  values: chunks.map(chunk => chunk.text),
  model: openai.embedding('text-embedding-3-small'),
});

// Store embeddings in PgVector
const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);
await pgVector.createIndex({
  indexName: 'embeddings',
  dimension: 1536,
});
await pgVector.upsert({
  indexName: 'embeddings',
  vectors: embeddings,
  metadata: chunks?.map((chunk: any) => ({ text: chunk.text })),
});

// Example usage
const query = 'explain technical trading analysis';

// Get query embedding
const { embedding: queryEmbedding } = await embed({
  value: query,
  model: openai.embedding('text-embedding-3-small'),
});

// Get initial results
const initialResults = await pgVector.query({
  indexName: 'embeddings',
  queryVector: queryEmbedding,
  topK: 3,
});

// Re-rank results
const rerankedResults = await rerank(initialResults, query, openai('gpt-4o-mini'), {
  weights: {
    semantic: 0.5,
    vector: 0.3,
    position: 0.2,
  },
  topK: 3,
});

console.log('Initial Results:');
initialResults.forEach((result, index) => {
  console.log(`Result ${index + 1}:`, {
    text: result.metadata?.text,
    score: result.score,
  });
});

console.log('Re-ranked Results:');
rerankedResults.forEach(({ result, score, details }, index) => {
  console.log(`Result ${index + 1}:`, {
    text: result.metadata?.text,
    score: score,
    semantic: details.semantic,
    vector: details.vector,
    position: details.position,
  });
});
