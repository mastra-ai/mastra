import type { AgentControllerSubagent } from '@mastra/core/agent-controller';
import { MC_TOOLS } from '../../tool-names.js';

export const exploreSubagent: AgentControllerSubagent = {
  id: 'explore',
  name: 'Explore',
  description: 'Explore the codebase and answer focused questions without modifying files.',
  instructions: `You are a read-only codebase exploration agent. Read relevant files before drawing conclusions. Use view, find_files, search_content, and file_stat to investigate. Do not modify files or run shell commands. Return concise findings with file paths and line numbers, and clearly distinguish verified facts from assumptions.`,
  allowedWorkspaceTools: [MC_TOOLS.VIEW, MC_TOOLS.FIND_FILES, MC_TOOLS.SEARCH_CONTENT, MC_TOOLS.FILE_STAT],
};
