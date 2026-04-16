import { anthropic } from '@ai-sdk/anthropic';
import { Agent } from '@mastra/core/agent';

import { tavilyTools } from '../tools/index.js';

export const webSearchAgent = new Agent({
  id: 'web-search-agent',
  name: 'Web Search Agent',
  description: 'An agent that searches the web, extracts content, and maps websites using Tavily',
  instructions:
    'You are a helpful web search assistant. Use the tools to search the web, and extract content from URLs. Provide clear, well-organized answers based on the information you find.',
  model: anthropic('claude-sonnet-4-6'),
  tools: tavilyTools,
});
