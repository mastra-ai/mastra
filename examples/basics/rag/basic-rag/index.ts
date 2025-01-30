import { Mastra, Agent } from '@mastra/core';
import { createVectorQueryTool } from '@mastra/rag';
import { PgVector } from '@mastra/vector-pg';

const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  options: {
    provider: 'OPEN_AI',
    model: 'text-embedding-3-small',
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

// Add in your documents, chunking and vector embedding here

const prompt = `
[Insert query based on document here]
Please base your answer only on the context provided in the tool. 
If the context doesn't contain enough information to fully answer the question, please state that explicitly.
`;

const completion = await agent.generate(prompt);
console.log(completion.text);
