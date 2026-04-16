import { createTavilySearchTool, createTavilyExtractTool } from '@mastra/tavily';

export const tavilyTools = {
  search: createTavilySearchTool(),
  extract: createTavilyExtractTool(),
};
