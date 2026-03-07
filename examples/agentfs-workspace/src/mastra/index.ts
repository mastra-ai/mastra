import { Mastra } from '@mastra/core/mastra';
import { notesAgent } from './agents';
import { agentfsWorkspace } from './workspaces';

export { agentfsWorkspace, readonlyWorkspace } from './workspaces';

export const mastra = new Mastra({
  agents: { notesAgent },
  workspace: agentfsWorkspace,
});
