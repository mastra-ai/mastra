import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { supervisedSandboxWorkspace } from '../workspaces';

/**
 * Automation agent - runs automated tasks and scripts.
 *
 * Workspace: supervisedSandboxWorkspace
 * Safety: requireSandboxApproval: 'all' (all sandbox ops need approval)
 */
export const automationAgent = new Agent({
  id: 'automation-agent',
  name: 'Automation Agent',
  description: 'An agent that runs automated tasks and scripts.',
  instructions: `You are an automation assistant.

Your job is to help automate tasks by running code and commands.

When automating:
1. Use workspace tools to read configuration and data files
2. Execute code to process data and perform tasks
3. Run commands for system operations
4. Report results clearly

Use workspace sandbox tools to execute code and commands as needed.`,

  model: openai('gpt-4o-mini'),
  workspace: supervisedSandboxWorkspace,
});
