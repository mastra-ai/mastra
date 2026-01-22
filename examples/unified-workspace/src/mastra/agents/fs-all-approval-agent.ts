import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { fsAllApprovalWorkspace } from '../workspaces';

/**
 * Filesystem all approval agent - requires approval for all filesystem operations.
 *
 * Workspace: fsAllApprovalWorkspace
 * Safety: requireFilesystemApproval: 'all'
 *
 * - All filesystem operations require approval (handled by framework)
 */
export const fsAllApprovalAgent = new Agent({
  id: 'fs-all-approval-agent',
  name: 'FS All Approval Agent',
  description: 'A file management assistant for workspace operations.',
  instructions: `You are a file management assistant.

Your job is to help users manage files in the workspace.

When working with files:
1. Use workspace tools to read files and understand content
2. Use workspace tools to list directories and explore structure
3. Use workspace tools to write and create files as needed
4. Use workspace tools to delete files when requested

Use workspace filesystem tools to perform file operations as needed.`,

  model: openai('gpt-4o-mini'),
  workspace: fsAllApprovalWorkspace,
});
