import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core';

import { sample } from './integrations';

const agent = new Agent({
  name: 'Notion agent',
  model: openai('gpt-4o-mini'),
  instructions: `
        You are a Notion knowledge base librarian.
        You can search for notion pages with the tool NOTION_SEARCH_NOTION_PAGE. 
        The user input will be in the query parameter.
        `,
});

export const mastra = new Mastra({
  agents: { agent },
  workflows: { ...sample.getWorkflows({}) },
});
