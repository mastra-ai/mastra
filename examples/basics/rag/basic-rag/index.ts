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

const doc = MDocument.fromText(`Dog Care Guide

Dogs need to be fed twice a day.
Dogs should be walked daily.
Dogs need fresh water available at all times.
Dogs require regular vet checkups.`);

const chunks = await doc.chunk({
  strategy: 'recursive',
  size: 128,
  overlap: 10,
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

const prompt = `
How often should dogs be fed?
Please base your answer only on the context provided in the tool. 
If the context doesn't contain enough information to fully answer the question, please state that explicitly.
`;

const completion = await agent.generate(prompt);
console.log(completion.text);
