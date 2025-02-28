import { openai } from '@ai-sdk/openai';
import { PineconeVector } from '@mastra/pinecone';
import { MDocument } from '@mastra/rag';
import { embedMany } from 'ai';

const doc = MDocument.fromText('Your text content...');

const chunks = await doc.chunk();

const { embeddings } = await embedMany({
  values: chunks.map(chunk => chunk.text),
  model: openai.embedding('text-embedding-3-small'),
});

const pinecone = new PineconeVector(process.env.PINECONE_API_KEY!);

await pinecone.createIndex({
  indexName: 'test_index',
  dimension: 1536,
});

await pinecone.upsert({
  indexName: 'test_index',
  vectors: embeddings,
  metadata: chunks?.map((chunk: any) => ({ text: chunk.text })),
});

const results = await pinecone.query({
  indexName: 'test_index',
  queryVector: embeddings[0],
  topK: 10,
});

console.log(results);
