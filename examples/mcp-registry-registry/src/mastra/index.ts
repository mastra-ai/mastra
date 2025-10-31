import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { mcpRegistryAgent } from './agents/index';

export const mastra = new Mastra({
  agents: { mcpRegistryAgent },
  logger: new PinoLogger({ name: 'MCP Registry', level: 'info' }),
});
