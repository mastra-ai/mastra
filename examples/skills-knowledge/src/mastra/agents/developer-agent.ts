import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { SkillsProcessor } from '@mastra/skills';

/**
 * Skills processor with NO config - inherits from Mastra instance.
 *
 * This demonstrates the recommended pattern: register skills globally
 * on the Mastra instance, then agents can inherit them automatically.
 */
const skillsProcessor = new SkillsProcessor();

/**
 * Developer agent that helps with code reviews and API design.
 *
 * This agent demonstrates:
 * 1. SkillsProcessor with no config - inherits skills from Mastra instance
 * 2. Access to all global skills registered with Mastra
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
- brand-guidelines: Writing style for documentation

When helping with code or design:
1. Activate the relevant skill to get detailed guidelines
2. Apply the guidelines to your review or suggestions
3. Be specific and provide examples

Available actions:
- Use skill-activate to load a skill's full instructions
- Use skill-search to find specific information across skills`,

  model: openai('gpt-4o-mini'),

  // SkillsProcessor inherits skills from Mastra instance
  // All skills registered with mastra.skills are available
  inputProcessors: [skillsProcessor],
});
