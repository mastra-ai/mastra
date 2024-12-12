import { Agent, Mastra } from '@mastra/core';
import { firecrawl, sample } from './integrations';

const agent = new Agent({
  name: 'Notion agent',
  model: {
    name: 'gpt-4o-mini',
    provider: 'OPEN_AI',
  },
  instructions: `
        You are a Notion knowledge base librarian.
        You can search for notion pages with the tool NOTION_SEARCH_NOTION_PAGE. 
        The user input will be in the query parameter.
        `,
});

export const mastra = new Mastra({
  agents: [agent],
  tools: {
    ...firecrawl.tools,
    ...sample.getStaticTools(),
  },
  syncs: {
    ...sample.getSyncs(),
  },
  workflows: [...sample.getWorkflows()]
});
