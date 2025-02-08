import { cohere } from '@ai-sdk/cohere';
import { MDocument } from '@mastra/rag';
import { embedMany } from 'ai';

const doc = MDocument.fromText('Your text content...');

const chunks = await doc.chunk();

const { embeddings } = await embedMany({
  model: cohere.embedding('embed-english-v3.0'),
  values: chunks.map(chunk => chunk.text),
});

console.log(embeddings);
