import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { skillsOnlyWorkspace } from '../workspaces';

/**
 * Skills-only agent - has workspace with ONLY skills (no filesystem, no sandbox).
 *
 * Workspace: skillsOnlyWorkspace
 * - Skills: /skills and /docs-skills (loaded read-only via LocalSkillSource)
 * - No filesystem tools (workspace_read_file, workspace_write_file, etc.)
 * - No sandbox tools (execute_code, execute_command)
 *
 * This demonstrates the minimal workspace configuration for agents that only
 * need behavioral guidelines without file or code execution access.
 *
 * Use cases:
 * - Conversational agents with specific guidelines
 * - Customer service bots following brand guidelines
 * - Agents focused on following instructions without needing file access
 */
export const skillsOnlyAgent = new Agent({
  id: 'skills-only-agent',
  name: 'Skills Only Agent',
  description: 'An agent that only has access to skills (no filesystem or sandbox).',
  instructions: `You are a helpful assistant with access to skills that guide your behavior.

Your workspace has skills but NO filesystem or sandbox access:
- You can list and read skills to understand guidelines
- You CANNOT read/write files
- You CANNOT execute code or commands

Use your skills to guide your responses. If asked to do something that requires
file access or code execution, explain that you don't have those capabilities.

Available skills provide guidelines for:
- Code review best practices
- API design patterns
- Customer support interactions
- Brand guidelines for documentation`,

  model: openai('gpt-4o-mini'),
  workspace: skillsOnlyWorkspace,
});
