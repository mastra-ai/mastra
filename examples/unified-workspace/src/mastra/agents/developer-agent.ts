import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

/**
 * Developer agent that helps with code reviews and API design.
 *
 * This agent demonstrates:
 * 1. Using workspace skills for development guidelines
 * 2. Skills are discovered from SKILL.md files in skillsPaths
 * 3. Skills visible in Workspace UI (/workspace page, Skills tab)
 */
export const developerAgent = new Agent({
  id: 'developer-agent',
  name: 'Developer Agent',
  description: 'An agent that helps with code reviews and API design using workspace skills.',
  instructions: `You are a helpful developer assistant.

You have access to workspace skills that can help you:
- code-review: Guidelines for reviewing TypeScript code
- api-design: Best practices for REST API and TypeScript interface design
- customer-support: Support interaction guidelines

When helping with code or design:
1. Reference the relevant skill for detailed guidelines
2. Apply the guidelines to your review or suggestions
3. Be specific and provide examples

Skills are discovered from SKILL.md files in the workspace and can be
searched via workspace.skills.search() or listed via workspace.skills.list().`,

  model: openai('gpt-4o-mini'),
});
