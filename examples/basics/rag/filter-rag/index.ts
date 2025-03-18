import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { PgVector } from '@mastra/pg';
import { createVectorQueryTool, MDocument, PGVECTOR_PROMPT } from '@mastra/rag';
import { embedMany } from 'ai';

const vectorQueryTool = createVectorQueryTool({
  id: 'vectorQueryTool',
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  model: openai.embedding('text-embedding-3-small'),
  enableFilter: true,
});

const doc = MDocument.fromText(`The Impact of Climate Change on Global Agriculture

Climate change poses significant challenges to global agriculture and food security. Rising temperatures, changing precipitation patterns, and increased frequency of extreme weather events are affecting crop yields worldwide.

Temperature Effects
Global warming has led to shifts in growing seasons and altered crop development cycles. Many regions are experiencing longer periods of drought, while others face excessive rainfall. These changes directly impact plant growth and development.

Crop Yield Impact
Studies show that major staple crops like wheat, rice, and maize are particularly vulnerable to temperature increases. For every degree Celsius increase in global mean temperature, wheat yields are expected to decrease by 6%.

Adaptation Strategies
Farmers are implementing various adaptation strategies:
1. Developing drought-resistant crop varieties
2. Adjusting planting dates to match new seasonal patterns
3. Implementing improved irrigation systems
4. Diversifying crop selections to reduce risk

Future Implications
The agricultural sector must continue to innovate and adapt to ensure food security for a growing global population. This includes developing new technologies, improving water management, and enhancing soil conservation practices.`);

const chunks = await doc.chunk({
  strategy: 'recursive',
  size: 512,
  overlap: 50,
  separator: '\n',
  extract: {
    keywords: true,
  },
});

const chunkMetadata = chunks?.map((chunk: any, index: number) => ({
  text: chunk.text,
  ...chunk.metadata,
  nested: {
    keywords: chunk.metadata.excerptKeywords
      .replace('KEYWORDS:', '')
      .split(',')
      .map(k => k.trim()),
    id: index,
  },
}));

export const ragAgent = new Agent({
  name: 'RAG Agent',
  model: openai('gpt-4o-mini'),
  instructions: `
  You are a helpful assistant that answers questions based on the provided context. Keep your answers concise and relevant.

  Filter the context by searching the metadata.
  
  The metadata is structured as follows:

  {
    text: string,
    excerptKeywords: string,
    nested: {
      keywords: string[],
      id: number,
    },
  }

  ${PGVECTOR_PROMPT}

  Important: When asked to answer a question, please base your answer only on the context provided in the tool. 
  If the context doesn't contain enough information to fully answer the question, please state that explicitly.
  `,
  tools: { vectorQueryTool },
});

const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);

export const mastra = new Mastra({
  agents: { ragAgent },
  vectors: { pgVector },
});

const agent = mastra.getAgent('ragAgent');
const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks.map(chunk => chunk.text),
});

const vectorStore = mastra.getVector('pgVector');
await vectorStore.createIndex({
  indexName: 'embeddings',
  dimension: 1536,
});
await vectorStore.upsert({
  indexName: 'embeddings',
  vectors: embeddings,
  metadata: chunkMetadata,
});

const answerOne = await agent.generate('What are the adaptation strategies mentioned?');
console.log('\nQuery:', 'What are the adaptation strategies mentioned?');
console.log('Response:', answerOne.text);

const answerTwo = await agent.generate(
  'Show me recent sections. Check the "nested.id" field and return values that are greater than 2.',
);
console.log(
  '\nQuery:',
  'Show me recent sections. Check the "nested.id" field and return values that are greater than 2.',
);
console.log('Response:', answerTwo.text);

const answerThree = await agent.generate(
  'Search the "text" field using regex operator to find sections containing "temperature".',
);
console.log('\nQuery:', 'Search the "text" field using regex operator to find sections containing "temperature".');
console.log('Response:', answerThree.text);
