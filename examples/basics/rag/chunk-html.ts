import { MDocument } from '@mastra/rag';

const doc = MDocument.fromHTML('<p>Your HTML content...</p>');

const chunks = await doc.chunk();

console.log(chunks);