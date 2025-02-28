import { openai } from '@ai-sdk/openai';
import { ChromaVector } from '@mastra/chroma';
import { MDocument } from '@mastra/rag';
import { embedMany } from 'ai';

const doc = MDocument.fromText('Your text content...');

const chunks = await doc.chunk();

const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks.map(chunk => chunk.text),
});

const chroma = new ChromaVector({
  path: process.env.CHROMA_DB_PATH!,
});

await chroma.createIndex({
  indexName: 'test_collection',
  dimension: 1536,
});

// Store both metadata and original documents in Chroma
await chroma.upsert({
  indexName: 'test_collection',
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })), // metadata
  documents: chunks.map(chunk => chunk.text), // store original documents
});
