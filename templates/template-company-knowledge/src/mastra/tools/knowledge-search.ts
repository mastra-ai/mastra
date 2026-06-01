import { createVectorQueryTool } from '@mastra/rag';
import { openai } from '@ai-sdk/openai';

export const KNOWLEDGE_INDEX = 'company_knowledge';

export const searchKnowledge = createVectorQueryTool({
  id: 'search-knowledge',
  description:
    'Semantic search over indexed Linear issues and Notion pages. Use this BEFORE falling back to live Linear/Notion lookups or web search.',
  vectorStoreName: 'pgVector',
  indexName: KNOWLEDGE_INDEX,
  model: openai.embedding('text-embedding-3-small'),
});
