import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';

import { 
  weatherAgent, 
  keywordResearcherAgent, 
  contentPlannerAgent, 
  blogWriterAgent, 
  editorAgent 
} from './agents';
import { escortBlogWorkflow } from './workflows/blogWorkflow';

export const mastra = new Mastra({
  agents: { 
    weatherAgent,
    keywordResearcherAgent,
    contentPlannerAgent,
    blogWriterAgent,
    editorAgent
  },
  workflows: {
    escortBlogWorkflow
  },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
