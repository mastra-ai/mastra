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

await chroma.createIndex('test_collection', 1536);

// Store both metadata and original documents in Chroma
await chroma.upsert(
  'test_collection',
  embeddings,
  chunks.map(chunk => ({ text: chunk.text })), // metadata
  undefined, // let Chroma auto-generate IDs
  chunks.map(chunk => chunk.text), // store original documents
);
