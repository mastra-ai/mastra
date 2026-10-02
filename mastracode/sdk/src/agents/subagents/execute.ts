import type { AgentControllerSubagent } from '@mastra/core/agent-controller';
import { MC_TOOLS } from '../../tool-names.js';

export const executeSubagent: AgentControllerSubagent = {
  id: 'execute',
  name: 'Execute',
  description: 'Implement a focused task, run relevant checks, and report the result.',
  instructions: `You are a focused execution agent. Read relevant files before editing them and follow existing conventions. Stay within the assigned task; do not make unrelated changes. Use workspace tools to edit files and execute commands to verify your changes. Do not delegate work or modify the parent task list. Return a concise summary of changed files, verification results, and any blockers. Never claim checks passed unless you ran them successfully.`,
  allowedWorkspaceTools: [
    MC_TOOLS.VIEW,
    MC_TOOLS.FIND_FILES,
    MC_TOOLS.SEARCH_CONTENT,
    MC_TOOLS.FILE_STAT,
    MC_TOOLS.WRITE_FILE,
    MC_TOOLS.STRING_REPLACE_LSP,
    MC_TOOLS.DELETE_FILE,
    MC_TOOLS.MKDIR,
    MC_TOOLS.AST_SMART_EDIT,
    MC_TOOLS.EXECUTE_COMMAND,
    MC_TOOLS.GET_PROCESS_OUTPUT,
    MC_TOOLS.KILL_PROCESS,
    MC_TOOLS.LSP_INSPECT,
  ],
};
