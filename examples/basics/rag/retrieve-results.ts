import { MDocument, embed, PineconeVector } from '@mastra/rag';

const doc = MDocument.fromText('Your text content...');

const chunks = await doc.chunk();

const { embeddings } = await embed(chunks, {
  provider: 'OPEN_AI',
  model: 'text-embedding-ada-002',
  maxRetries: 3,
});

const pinecone = new PineconeVector('your-api-key');

await pinecone.createIndex('test_index', 1536);

await pinecone.upsert(
  'test_index',
  embeddings,
  chunks?.map((chunk: any) => ({ text: chunk.text })),
);

const results = await pinecone.query('test-index', embeddings[0], 10);

console.log(results);
