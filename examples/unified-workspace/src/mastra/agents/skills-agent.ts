import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { docsAgentWorkspace } from '../workspaces';

/**
 * Documentation agent with its own workspace that includes both:
 * - Global skills (code-review, api-design, customer-support)
 * - Agent-specific skills (brand-guidelines)
 *
 * This demonstrates skill inheritance - the agent's workspace includes
 * all global skills PLUS its own specialized skills.
 */
export const docsAgent = new Agent({
  id: 'docs-agent',
  name: 'Documentation Agent',
  description: 'An agent that writes documentation following brand guidelines.',
  instructions: `You are a technical documentation writer for Mastra.

Your job is to help write clear, technical documentation that follows Mastra's brand guidelines.

When writing documentation:
1. First, check the "brand-guidelines" skill to understand the writing style
2. Follow the voice & tone guidelines strictly
3. Avoid marketing language - focus on technical details
4. Use the correct brand colors when relevant
5. Keep explanations concise and specific

You have access to a workspace with skills:
- brand-guidelines: Your primary skill for documentation writing style
- code-review: Guidelines for reviewing code (inherited from global)
- api-design: API design best practices (inherited from global)
- customer-support: Support interaction guidelines (inherited from global)`,

  model: openai('gpt-4o-mini'),

  // Agent workspace inherits global skills + adds brand-guidelines
  workspace: docsAgentWorkspace,
});
