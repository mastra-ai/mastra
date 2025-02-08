import { openai } from '@ai-sdk/openai';
import { MDocument } from '@mastra/rag';
import { embed } from 'ai';

const doc = MDocument.fromText('Your text content...');

const chunks = await doc.chunk();

const { embedding } = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: chunks[0].text,
});

console.log(embedding);
