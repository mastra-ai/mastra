import { MDocument, embed, embedMany } from '@mastra/rag';

const doc = MDocument.fromText('Your text content...');

const chunks = await doc.chunk();

const { embeddings } = await embedMany(chunks, {
  provider: 'COHERE',
  model: 'embed-english-v3.0',
  maxRetries: 3,
});

console.log(embeddings);
