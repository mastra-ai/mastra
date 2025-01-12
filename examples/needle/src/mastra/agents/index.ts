import { Agent } from '@mastra/core';

import { searchKnowledge } from '../tools';

export const knowledgeAgent = new Agent({
  name: 'knowledge-assistant',
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o-mini',
    toolChoice: 'auto',
  },
  instructions: `You are a helpful assistant with access to a knowledge base.
When asked questions, use the search_knowledge tool to find relevant information,
then provide accurate answers based on that information. If there is no infromation say, that you do not know.`,
  tools: {
    search_knowledge: searchKnowledge,
  },
});
