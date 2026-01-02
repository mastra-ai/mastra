import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { SkillsProcessor } from '@mastra/skills';

/**
 * Skills processor - provides skill activation tools to the agent.
 * When the agent needs domain-specific knowledge (like brand guidelines),
 * it can activate the appropriate skill using the provided tools.
 */
const skillsProcessor = new SkillsProcessor({
  // Skills are auto-discovered from the configured paths
  skillsPaths: ['./skills'],
});

/**
 * Documentation agent that uses skills for brand-consistent writing.
 *
 * This agent demonstrates:
 * 1. SkillsProcessor - provides skill activation tools
 * 2. Tool-based skill activation - agent decides when to use skills
 * 3. SKILL.md format - skills are defined in markdown with frontmatter
 */
export const docsAgent = new Agent({
  id: 'docs-agent',
  name: 'Documentation Agent',
  description: 'An agent that writes documentation following brand guidelines using skills.',
  instructions: `You are a technical documentation writer for Mastra.

Your job is to help write clear, technical documentation that follows Mastra's brand guidelines.

When writing documentation:
1. First, activate the "brand-guidelines" skill to understand the writing style
2. Follow the voice & tone guidelines strictly
3. Avoid marketing language - focus on technical details
4. Use the correct brand colors when relevant
5. Keep explanations concise and specific

Available actions:
- Use the skills tools to list and activate relevant skills
- Once a skill is activated, its instructions become available to guide your writing`,

  model: openai('gpt-4o-mini'),

  // SkillsProcessor adds tools for skill management
  inputProcessors: [skillsProcessor],
});
