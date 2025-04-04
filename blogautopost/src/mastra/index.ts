import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';

import {
  weatherAgent,
  contentPlannerAgent,
  blogWriterAgent,
  editorAgent,
  contentPublisherAgent,
  browserAgent,
  searchAgent,
} from './agents';
import { escortBlogWorkflow } from './workflows/blogWorkflow';
import { browserWorkflow } from './workflows/browserWorkflow';

export const mastra = new Mastra({
  agents: {
    weatherAgent,
    contentPlannerAgent,
    blogWriterAgent,
    editorAgent,
    contentPublisherAgent,
    browserAgent,
    searchAgent,
  },
  workflows: {
    escortBlogWorkflow,
    browserWorkflow,
  },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});

// Browser automation exports
export * from './mcp';
export { browserTool, serpApiTool } from './tools';
export { browserAgent, createBrowserAgentWithMCP } from './agents/browserAgent';
export { searchAgent, weatherAgent } from './agents';
export { browserWorkflow } from './workflows/browserWorkflow';
