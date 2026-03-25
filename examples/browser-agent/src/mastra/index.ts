import { Mastra } from '@mastra/core/mastra';
import { agentBrowserAgent, stagehandAgent, workspaceBrowserAgent } from './agents/index.js';

export const mastra = new Mastra({
  agents: { agentBrowserAgent, stagehandAgent, workspaceBrowserAgent },
});
