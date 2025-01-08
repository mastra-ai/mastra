import { MDocument, embed, PgVector } from '@mastra/rag';
import dotenv from 'dotenv';

dotenv.config();

const doc = MDocument.fromText('Your text content...');

const chunks = await doc.chunk();

const { embeddings } = await embed(chunks, {
  provider: 'OPEN_AI',
  model: 'text-embedding-ada-002',
  maxRetries: 3,
});

const pgVector = new PgVector('postgresql://localhost:5432/mydb'); // TODO: change to your database

await pgVector.createIndex('test_index', 1536);

await pgVector.upsert(
  'test_index',
  embeddings,
  chunks?.map((chunk: any) => ({ text: chunk.text })),
);
