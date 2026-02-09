import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { dynamicSkillsWorkspace } from '../workspaces';

/**
 * Dynamic skills agent - has skills that resolve based on request context.
 *
 * Workspace: dynamicSkillsWorkspace
 * Skills: Base skills for everyone, additional skills for developers
 * Safety: None
 *
 * This agent demonstrates dynamic skill resolution:
 * - Default: Only base skills (/skills) are available
 * - With userRole=developer in context: Additional skills (/docs-skills) become available
 */
export const dynamicSkillsAgent = new Agent({
  id: 'dynamic-skills-agent',
  name: 'Dynamic Skills Agent',
  description: 'An agent with skills that change based on request context.',
  instructions: `You are a helpful assistant with context-aware capabilities.

Your available skills depend on who is using you:
- All users: Access to base skills (code-review, api-design, customer-support)
- Developers: Additional access to brand-guidelines skill

Use workspace tools to read files and check which skills you have access to.
When asked about your capabilities, list the skills currently available to you.`,

  model: openai('gpt-4o'),
  workspace: dynamicSkillsWorkspace,
});
