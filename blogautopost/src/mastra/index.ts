import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';

import { 
  weatherAgent, 
  keywordResearcherAgent, 
  contentPlannerAgent, 
  blogWriterAgent, 
  editorAgent,
  contentPublisherAgent,
  browserAgent
} from './agents';
import { educationBlogWorkflow } from './workflows/blogWorkflow';
import { browserWorkflow } from './workflows/browserWorkflow';

export const mastra = new Mastra({
  agents: { 
    weatherAgent,
    keywordResearcherAgent,
    contentPlannerAgent,
    blogWriterAgent,
    editorAgent,
    contentPublisherAgent,
    browserAgent
  },
  workflows: {
    educationBlogWorkflow,
    browserWorkflow
  },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});

// Browser automation exports
export * from './mcp';
export { browserTool } from './tools';
export { browserAgent, createBrowserAgentWithMCP } from './agents/browserAgent';
export { browserWorkflow } from './workflows/browserWorkflow';
