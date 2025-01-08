import { MDocument } from '@mastra/rag';

const testJson = {
  name: 'John Doe',
  age: 30,
  email: 'john.doe@example.com',
};

const doc = MDocument.fromJSON(JSON.stringify(testJson));

const chunks = await doc.chunk({
  maxSize: 100,
});

console.log(chunks);
