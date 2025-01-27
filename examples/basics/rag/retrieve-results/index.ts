import { MDocument, embed } from '@mastra/rag';
import { PineconeVector } from '@mastra/vector-pinecone';

const doc = MDocument.fromText('Your text content...');

const chunks = await doc.chunk();

const { embeddings } = await embed(chunks, {
  provider: 'OPEN_AI',
  model: 'text-embedding-3-small',
  maxRetries: 3,
});

const pinecone = new PineconeVector(process.env.PINECONE_API_KEY!);

await pinecone.createIndex('test_index', 1536);

await pinecone.upsert(
  'test_index',
  embeddings,
  chunks?.map((chunk: any) => ({ text: chunk.text })),
);

const results = await pinecone.query('test_index', embeddings[0], 10);

console.log(results);
