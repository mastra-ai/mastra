import { Mastra, Agent, EmbedManyResult } from '@mastra/core';
import { embed, MDocument, createVectorQueryTool } from '@mastra/rag';
import { PgVector } from '@mastra/vector-pg';

const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  options: {
    provider: 'OPEN_AI',
    model: 'text-embedding-ada-002',
    maxRetries: 3,
  },
  topK: 3,
});

export const ragAgent = new Agent({
  name: 'RAG Agent',
  instructions:
    'You are a helpful assistant that answers questions based on the provided context. Keep your answers concise and relevant.',
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o-mini',
  },
  tools: {
    vectorQueryTool,
  },
});

const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);

export const mastra = new Mastra({
  agents: { ragAgent },
  vectors: { pgVector },
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

const { embeddings } = (await embed(chunks, {
  provider: 'OPEN_AI',
  model: 'text-embedding-ada-002',
  maxRetries: 3,
})) as EmbedManyResult<string>;

const vectorStore = mastra.getVector('pgVector');
await vectorStore.createIndex('embeddings', 1536);
await vectorStore.upsert(
  'embeddings',
  embeddings,
  chunks?.map((chunk: any) => ({ text: chunk.text })),
);

async function generateResponse(query: string) {
  const prompt = `
      Please answer the following question:
      ${query}

      Please base your answer only on the context provided in the tool. If the context doesn't contain enough information to fully answer the question, please state that explicitly.
      `;

  // Call the agent to generate a response
  const completion = await agent.generate(prompt);

  return completion.text;
}

async function answerQueries(queries: string[]) {
  for (const query of queries) {
    try {
      // Generate and log the response
      const answer = await generateResponse(query);
      console.log('\nQuery:', query);
      console.log('Response:', answer);
    } catch (error) {
      console.error(`Error processing query "${query}":`, error);
    }
  }
}

const queries = [
  'What are the main adaptation strategies for farmers?',
  'What are the main points in the article?',
  'How does temperature affect crop yields?',
  'What solutions are farmers implementing?',
  'What are the future challenges mentioned in the text?',
];

await answerQueries(queries);
