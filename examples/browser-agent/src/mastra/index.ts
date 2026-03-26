import { Mastra } from '@mastra/core/mastra';
import {
  agentBrowserAgent,
  stagehandAgent,
  workspaceAgentBrowserAgent,
  workspaceBrowserUseAgent,
} from './agents/index.js';

export const mastra = new Mastra({
  agents: { agentBrowserAgent, stagehandAgent, workspaceAgentBrowserAgent, workspaceBrowserUseAgent },
});
