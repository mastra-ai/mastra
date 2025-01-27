import { MDocument, embed } from '@mastra/rag';

const doc = MDocument.fromText('Your text content...');

const chunks = await doc.chunk();

const { embeddings } = await embed(chunks, {
  provider: 'OPEN_AI',
  model: 'text-embedding-3-small',
  maxRetries: 3,
});

console.log(embeddings);
