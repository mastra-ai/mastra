import { openai } from '@ai-sdk/openai';
import { ChromaVector } from '@mastra/chroma';
import { MDocument } from '@mastra/rag';
import { embedMany } from 'ai';

const doc = MDocument.fromText('Your text content...');

const chunks: { text: string }[] = await doc.chunk();

const { embeddings } = await embedMany({
  model: openai.textEmbeddingModel('text-embedding-3-small'),
  values: chunks.map(chunk => chunk.text),
});

const chroma = new ChromaVector({
  apiKey: process.env.CHROMA_API_KEY,
  tenant: process.env.CHROMA_TENANT,
  database: process.env.CHROMA_DATABASE,
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
