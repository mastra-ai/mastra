import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { AgentFSFilesystem } from '@mastra/agentfs';

/**
 * A note-taking agent backed by AgentFS.
 *
 * The agent gets workspace tools automatically:
 *   - mastra_workspace_read_file
 *   - mastra_workspace_write_file
 *   - mastra_workspace_edit_file
 *   - mastra_workspace_list_files
 *   - mastra_workspace_delete
 *   - mastra_workspace_mkdir
 *   - mastra_workspace_file_stat
 */
export const notesAgent = new Agent({
  id: 'notes-agent',
  name: 'Notes Agent',
  description: 'An agent that takes and organizes notes in AgentFS storage.',
  instructions: `You are a note-taking assistant. You store notes as files in your workspace.

Organize notes into directories by topic. Use markdown format.
When asked to save a note, write it to an appropriate path like /notes/<topic>/<title>.md.
When asked to find or recall notes, list and read files from the /notes directory.`,
  model: 'openai/gpt-4o-mini',
  workspace: new Workspace({
    id: 'notes-workspace',
    name: 'Notes Workspace',
    filesystem: new AgentFSFilesystem({
      agentId: 'notes-agent',
    }),
  }),
});
