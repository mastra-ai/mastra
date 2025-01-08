import { MDocument } from '@mastra/rag';

const html = `
<div>
    <h1>h1 content...</h1>
    <p>p content...</p>
</div>
`;

const doc = MDocument.fromHTML(html);

const chunks = await doc.chunk({
  headers: [
    ['h1', 'Header 1'],
    ['p', 'Paragraph'],
  ],
});

console.log(chunks);
