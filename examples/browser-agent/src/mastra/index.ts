import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import {
  agentBrowserAgent,
  stagehandAgent,
  workspaceAgentBrowserAgent,
  workspaceBrowserUseAgent,
  workspacePlaywrightAgent,
} from './agents/index.js';

export const mastra = new Mastra({
  agents: {
    agentBrowserAgent,
    stagehandAgent,
    workspaceAgentBrowserAgent,
    workspaceBrowserUseAgent,
    workspacePlaywrightAgent,
  },
  storage: new LibSQLStore({
    id: 'browser-agent-storage',
    url: 'file:./mastra.db',
  }),
});
