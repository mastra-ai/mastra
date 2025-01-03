import { MDocument, embed } from '@mastra/rag';

const doc = MDocument.fromText('Your text content...');

const chunks = await doc.chunk();

const { embeddings } = await embed(chunks, {
  provider: 'COHERE',
  model: 'embed-english-v3.0',
  maxRetries: 3,
});

console.log(embeddings);
