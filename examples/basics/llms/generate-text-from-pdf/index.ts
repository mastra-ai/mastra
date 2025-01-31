import { Mastra } from '@mastra/core';
import { readFileSync } from 'fs';
import path from 'path';

const mastra = new Mastra();

const llm = mastra.LLM({
  provider: 'ANTHROPIC',
  name: 'claude-3-5-sonnet-20241022',
});

const buf = readFileSync(path.join(process.cwd(), './fridge-owners-manual.pdf'));

const response = await llm.generate([
  {
    role: 'user',
    content: [
      {
        type: 'file',
        mimeType: 'application/pdf',
        data: buf,
      },
      {
        type: 'text',
        text: "Please confirm you can see this PDF file by saying 'YES I can see the PDF' and then tell me what's in it.",
      },
    ],
  },
]);

console.log(response.text);
