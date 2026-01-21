import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { fsWriteApprovalWorkspace } from '../workspaces';

/**
 * Filesystem write approval agent - requires approval for write operations.
 *
 * Workspace: fsWriteApprovalWorkspace
 * Safety: requireFilesystemApproval: 'write'
 *
 * - Read operations run without approval
 * - Write operations require approval
 */
export const fsWriteApprovalAgent = new Agent({
  id: 'fs-write-approval-agent',
  name: 'FS Write Approval Agent',
  description: 'An agent that requires approval for filesystem write operations.',
  instructions: `You are a file management assistant with write approval requirements.

Your job is to help users manage files in the workspace.

When working with files:
1. Read files freely to understand content
2. List directories to explore structure
3. Write files only when approved by the user
4. Delete files only when approved by the user

All write operations will require user approval before execution.`,

  model: openai('gpt-4o-mini'),
  workspace: fsWriteApprovalWorkspace,
});
