import { Agent } from '@mastra/core/agent';
import { webSearchTool } from '@mastra/core/tools';

export const webSearchAgent = new Agent({
  id: 'web-search-agent',
  name: 'Web Search Agent',
  instructions: 'Use web search for current information.',
  model: 'google/gemini-3.5-flash',
  tools: {
    webSearch: webSearchTool,
  },
});
