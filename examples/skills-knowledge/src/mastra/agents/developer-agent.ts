import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

/**
 * Developer agent that helps with code reviews and API design.
 *
 * This agent demonstrates:
 * 1. Default skill inheritance - no `skills` config needed
 * 2. Automatically gets skills from Mastra instance (code-review, api-design, customer-support)
 * 3. Skills are visible in the /skills UI page
 */
export const developerAgent = new Agent({
  id: 'developer-agent',
  name: 'Developer Agent',
  description: 'An agent that helps with code reviews and API design using inherited skills.',
  instructions: `You are a helpful developer assistant.

You have access to several skills that can help you:
- code-review: Guidelines for reviewing TypeScript code
- api-design: Best practices for REST API and TypeScript interface design
- customer-support: Support interaction guidelines

When helping with code or design:
1. Activate the relevant skill to get detailed guidelines
2. Apply the guidelines to your review or suggestions
3. Be specific and provide examples

Available actions:
- Use skill-activate to load a skill's full instructions
- Use skill-search to find specific information across skills`,

  model: openai('gpt-4o-mini'),

  // No skills config needed - inherits from Mastra by default
});
