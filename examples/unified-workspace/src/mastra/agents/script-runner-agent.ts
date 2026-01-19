import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { commandApprovalWorkspace } from '../workspaces';

/**
 * Script runner agent - executes scripts and runs code.
 *
 * Workspace: commandApprovalWorkspace
 * Safety: requireSandboxApproval: 'commands' (only shell commands need approval)
 */
export const scriptRunnerAgent = new Agent({
  id: 'script-runner-agent',
  name: 'Script Runner Agent',
  description: 'An agent that executes scripts and runs code.',
  instructions: `You are a script execution assistant.

Your job is to help run scripts, execute code, and perform computations.

When running scripts:
1. Use workspace tools to read script files
2. Execute code for computations and data processing
3. Run shell commands for CLI tools when needed
4. Report output and results clearly

Use workspace sandbox tools to execute code and run commands.`,

  model: openai('gpt-4o-mini'),
  workspace: commandApprovalWorkspace,
});
