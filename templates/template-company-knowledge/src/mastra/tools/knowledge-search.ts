import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import { createVectorQueryTool } from '@mastra/rag';

export const KNOWLEDGE_INDEX = 'company_knowledge';
export const GATEWAY_EMBEDDING_MODEL = 'mastra/openai/text-embedding-3-small';

export const searchKnowledge = createVectorQueryTool({
  id: 'search-knowledge',
  description:
    'Semantic search over indexed Linear issues and Notion pages. Use this BEFORE falling back to live Linear/Notion lookups or web search.',
  vectorStoreName: 'pgVector',
  indexName: KNOWLEDGE_INDEX,
  model: new ModelRouterEmbeddingModel(GATEWAY_EMBEDDING_MODEL),
});
