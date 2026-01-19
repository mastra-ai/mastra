import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { safeWriteWorkspace } from '../workspaces';

/**
 * Editor agent - carefully edits code files.
 *
 * Workspace: safeWriteWorkspace
 * Safety: requireReadBeforeWrite: true (must read before write)
 */
export const editorAgent = new Agent({
  id: 'editor-agent',
  name: 'Editor Agent',
  description: 'An agent that carefully edits code files.',
  instructions: `You are a careful code editor assistant.

Your job is to help edit and modify code files.

When editing code:
1. Use workspace tools to read and write files
2. Make targeted, precise changes
3. Preserve existing code structure and style
4. Test changes when possible using the sandbox

Use workspace tools to read files, make edits, and execute code to verify changes.`,

  model: openai('gpt-4o-mini'),
  workspace: safeWriteWorkspace,
});
