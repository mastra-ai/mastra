import { openai } from '@ai-sdk/openai';
import { MilvusStore } from '@mastra/milvus';
import { MDocument } from '@mastra/rag';
import { embedMany } from 'ai';

const doc = MDocument.fromText('Your text content...');

const chunks = await doc.chunk();

const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks.map(chunk => chunk.text),
});

const milvus = new MilvusStore(
  process.env.MILVUS_URI || 'localhost:19530',
  process.env.MILVUS_USERNAME,
  process.env.MILVUS_PASSWORD,
  process.env.MILVUS_SSL === 'true',
);

await milvus.createIndex({
  indexName: 'testindex',
  dimension: 1536,
  metric: 'cosine',
});

await milvus.upsert({
  indexName: 'testindex',
  vectors: embeddings,
  metadata: chunks?.map(chunk => ({ text: chunk.text })),
});
