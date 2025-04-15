import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';
import { mcpRegistryAgent } from './agents/index';

export const mastra = new Mastra({
  agents: { mcpRegistryAgent },
  logger: createLogger({ name: 'MCP Registry', level: 'info' }),
});
