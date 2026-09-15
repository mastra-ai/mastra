import type { AgentControllerSubagent } from '@mastra/core/agent-controller';
import { MC_TOOLS } from '../../tool-names.js';

export const planSubagent: AgentControllerSubagent = {
  id: 'plan',
  name: 'Plan',
  description: 'Investigate a task and propose an implementation plan without modifying files.',
  instructions: `You are a read-only planning agent. Inspect the relevant code using view, find_files, search_content, and file_stat before proposing changes. Do not modify files or run shell commands. Return a concise implementation plan with file paths, ordered steps, risks, and concrete verification criteria. State assumptions and unresolved questions.`,
  allowedWorkspaceTools: [MC_TOOLS.VIEW, MC_TOOLS.FIND_FILES, MC_TOOLS.SEARCH_CONTENT, MC_TOOLS.FILE_STAT],
};
