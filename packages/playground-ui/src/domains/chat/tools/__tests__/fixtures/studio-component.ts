import type { GetAgentResponse, GetToolResponse } from '@mastra/client-js';

export const weatherCardComponentId = '0123456789abcdef';

const weatherTool: GetToolResponse = {
  id: 'get-weather',
  description: 'Get the weather for a city',
  ui: { studioComponent: weatherCardComponentId },
};

const searchDocsTool: GetToolResponse = {
  id: 'search-docs',
  description: 'Search the docs',
};

/** Agent whose `getWeather` tool ships a custom Studio component and whose `searchDocs` tool does not. */
export const agentWithStudioComponent: GetAgentResponse = {
  id: 'test-agent',
  name: 'Weather Agent',
  instructions: 'You report the weather.',
  tools: { getWeather: weatherTool, searchDocs: searchDocsTool },
  workflows: {},
  agents: {},
  provider: 'openai',
  modelId: 'gpt-4o-mini',
  modelVersion: 'v2',
  modelList: undefined,
  defaultOptions: {},
  defaultGenerateOptionsLegacy: {},
  defaultStreamOptionsLegacy: {},
};
