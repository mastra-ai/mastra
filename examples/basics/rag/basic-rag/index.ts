import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { PgVector } from '@mastra/pg';
import { createVectorQueryTool } from '@mastra/rag';

const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  model: openai.embedding('text-embedding-3-small'),
});

export const ragAgent = new Agent({
  name: 'RAG Agent',
  instructions:
    'You are a helpful assistant that answers questions based on the provided context. Keep your answers concise and relevant.',
  model: openai('gpt-4o-mini'),
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
