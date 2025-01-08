import { MDocument } from '@mastra/rag';

const doc = MDocument.fromText(`Your plain text content...`);

const chunks = await doc.chunk({
  separator: '\n',
});

console.log(chunks);
