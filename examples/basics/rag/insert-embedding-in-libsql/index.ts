import { openai } from '@ai-sdk/openai';
import { DefaultVectorDB } from '@mastra/core/storage';
import { MDocument } from '@mastra/rag';
import { embedMany } from 'ai';

const doc = MDocument.fromText('Your text content...');

const chunks = await doc.chunk();

const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks.map(chunk => chunk.text),
});

const libsql = new DefaultVectorDB({
  connectionUrl: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN, // Optional: for Turso cloud databases
});

await libsql.createIndex('test_collection', 1536);

await libsql.upsert(
  'test_collection',
  embeddings,
  chunks?.map((chunk: any) => ({ text: chunk.text })),
);
