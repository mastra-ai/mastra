import { createGraphRAGTool } from '@mastra/rag';

export const graphRagTool = createGraphRAGTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  options: {
    provider: 'OPEN_AI',
    model: 'text-embedding-ada-002',
    maxRetries: 3,
  },
  graphOptions: {
    dimension: 1536,
    threshold: 0.7,
  },
  topK: 5,
});
