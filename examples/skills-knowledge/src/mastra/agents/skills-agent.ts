import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Skills } from '@mastra/skills';

/**
 * Resolve docs-skills path - works from both project root and src/mastra/public/
 */
function resolveDocsSkillsPath(): string {
  // Try project root first (for demo scripts)
  const fromRoot = resolve(process.cwd(), 'docs-skills');
  if (existsSync(fromRoot)) {
    return fromRoot;
  }

  // Try from src/mastra/public/ (for mastra dev - 3 levels up)
  const fromOutput = resolve(process.cwd(), '../../../docs-skills');
  if (existsSync(fromOutput)) {
    return fromOutput;
  }

  // Fallback to project root path
  return fromRoot;
}

/**
 * Skills instance with docs-specific skills.
 *
 * This demonstrates agent-specific skills that are separate from Mastra's global skills.
 * The docs agent has brand-guidelines which other agents don't need.
 */
const docsSkills = new Skills({
  id: 'docs-skills',
  paths: [resolveDocsSkillsPath()],
});

/**
 * Documentation agent that uses skills for brand-consistent writing.
 *
 * This agent demonstrates:
 * 1. Agent-specific skills via the `skills` config field
 * 2. These skills (brand-guidelines) are separate from the global skills
 * 3. Other agents don't see or use these skills
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

  // Use agent-specific skills (brand-guidelines only)
  // This replaces any inherited skills from Mastra
  skills: docsSkills,
});
