import { Mastra, Agent, EmbedManyResult } from '@mastra/core';
import { embed, MDocument, PgVector, createVectorQueryTool } from '@mastra/rag';

const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  options: {
    provider: 'OPEN_AI',
    model: 'text-embedding-ada-002',
    maxRetries: 3,
  },
  topK: 5,
  rerankOptions: {
    semanticProvider: 'agent',
    agentProvider: {
      provider: 'OPEN_AI',
      name: 'gpt-4o-mini',
    },
  },
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

const doc1 = MDocument.fromText(`
market data shows price resistance levels.
technical charts display moving averages.
support levels guide trading decisions.
breakout patterns signal entry points.
price action determines trade timing.

baseball cards show gradual value increase.
rookie cards command premium prices.
card condition affects resale value.
authentication prevents fake trading.
grading services verify card quality.

volume analysis confirms price trends.
sports cards track seasonal demand.
chart patterns predict movements.
mint condition doubles card worth.
resistance breaks trigger orders.
rare cards appreciate yearly.
`);

const chunks = await doc1.chunk({
  strategy: 'recursive',
  size: 150,
  overlap: 20,
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
  'explain technical trading analysis',
  'explain trading card valuation',
  'how do you analyze market resistance',
];

await answerQueries(queries);