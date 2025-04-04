import { escortBlogWorkflow } from './workflows/blogWorkflow';
import { contentPlannerAgent, blogWriterAgent, editorAgent } from './agents';

export const workflows = {
  escortBlogWorkflow,
};

export const agents = {
  contentPlannerAgent,
  blogWriterAgent,
  editorAgent,
};

export const mastra = {
  workflows,
  agents,
};
