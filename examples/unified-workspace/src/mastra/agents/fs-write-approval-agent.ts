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
 * - Write operations require approval (handled by framework)
 */
export const fsWriteApprovalAgent = new Agent({
  id: 'fs-write-approval-agent',
  name: 'FS Write Approval Agent',
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
  workspace: fsWriteApprovalWorkspace,
});
