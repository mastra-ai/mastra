import { escortBlogWorkflow } from "./workflows/blogWorkflow";
import { 
  keywordResearcherAgent, 
  contentPlannerAgent, 
  blogWriterAgent, 
  editorAgent 
} from "./agents";

export const workflows = {
  escortBlogWorkflow,
};

export const agents = {
  keywordResearcherAgent,
  contentPlannerAgent,
  blogWriterAgent,
  editorAgent,
};

export const mastra = {
  workflows,
  agents,
}; 