import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { PgVector } from '@mastra/pg';
import { createVectorQueryTool, MDocument } from '@mastra/rag';
import { embedMany } from 'ai';

const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  model: openai.embedding('text-embedding-3-small'),
});

export const ragAgent = new Agent({
  name: 'RAG Agent',
  instructions: `You are a helpful assistant`,
  model: openai('gpt-4o-mini'),
  tools: { vectorQueryTool },
});

const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING);

export const mastra = new Mastra({
  agents: { ragAgent },
  vectors: { pgVector },
  telemetry: {
    enabled: true,
  },
});

const agent = mastra.getAgent('ragAgent');

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
});

const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks.map(chunk => chunk.text),
});

const answerOne = await agent.generate('What are the main adaptation strategies for farmers?');
console.log('\nQuery:', 'What are the main adaptation strategies for farmers?');
console.log('Response:', answerOne.text);

const answerTwo = await agent.generate('Analyze how temperature affects crop yields.');
console.log('\nQuery:', 'Analyze how temperature affects crop yields.');
console.log('Response:', answerTwo.text);

const answerThree = await agent.generate('What connections can you draw between climate change and food security?');
console.log('\nQuery:', 'What connections can you draw between climate change and food security?');
console.log('Response:', answerThree.text);
