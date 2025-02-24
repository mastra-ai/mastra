import { openai } from '@ai-sdk/openai';
import { PineconeVector } from '@mastra/pinecone';
import { MDocument } from '@mastra/rag';
import { embedMany } from 'ai';

const doc = MDocument.fromText('Your text content...');

const chunks = await doc.chunk();

const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks.map(chunk => chunk.text),
});

const pinecone = new PineconeVector(process.env.PINECONE_API_KEY!);

await pinecone.createIndex('testindex', 1536);

await pinecone.upsert(
  'testindex',
  embeddings,
  chunks?.map(chunk => ({ text: chunk.text })),
);
