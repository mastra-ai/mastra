import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { docsAgentWorkspace } from '../workspaces';

/**
 * Documentation agent - has own workspace with global + agent-specific skills.
 *
 * Workspace: docsAgentWorkspace
 * Skills: /skills (global) + /docs-skills (agent-specific)
 * Safety: None
 */
export const docsAgent = new Agent({
  id: 'docs-agent',
  name: 'Documentation Agent',
  description: 'An agent that writes documentation following brand guidelines.',
  instructions: `You are a technical documentation writer.

Your job is to help write clear, technical documentation that follows brand guidelines.

When writing documentation:
1. Check the "brand-guidelines" skill to understand the writing style
2. Follow the voice & tone guidelines strictly
3. Avoid marketing language - focus on technical details
4. Keep explanations concise and specific

You have access to workspace skills including brand-guidelines, code-review, and api-design.
Use workspace tools to read, write, and manage documentation files.`,

  model: openai('gpt-4o-mini'),
  workspace: docsAgentWorkspace,
});
