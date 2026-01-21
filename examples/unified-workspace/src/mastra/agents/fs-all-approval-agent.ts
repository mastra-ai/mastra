import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { fsAllApprovalWorkspace } from '../workspaces';

/**
 * Filesystem all approval agent - requires approval for all filesystem operations.
 *
 * Workspace: fsAllApprovalWorkspace
 * Safety: requireFilesystemApproval: 'all'
 *
 * - All filesystem operations require approval (read, list, write, delete, etc.)
 */
export const fsAllApprovalAgent = new Agent({
  id: 'fs-all-approval-agent',
  name: 'FS All Approval Agent',
  description: 'An agent that requires approval for all filesystem operations.',
  instructions: `You are a file management assistant with full approval requirements.

Your job is to help users manage files in the workspace.

When working with files:
1. Request to read files (requires approval)
2. Request to list directories (requires approval)
3. Request to write files (requires approval)
4. Request to delete files (requires approval)

All filesystem operations will require user approval before execution.`,

  model: openai('gpt-4o-mini'),
  workspace: fsAllApprovalWorkspace,
});
