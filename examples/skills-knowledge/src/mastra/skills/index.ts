import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Skills } from '@mastra/skills';

/**
 * Resolve skills path - works from both project root and src/mastra/public/
 */
function resolveSkillsPath(): string {
  // Try project root first (for demo scripts)
  const fromRoot = resolve(process.cwd(), 'skills');
  if (existsSync(fromRoot)) {
    return fromRoot;
  }

  // Try from src/mastra/public/ (for mastra dev - 3 levels up)
  const fromOutput = resolve(process.cwd(), '../../../skills');
  if (existsSync(fromOutput)) {
    return fromOutput;
  }

  // Fallback to project root path
  return fromRoot;
}

/**
 * Skills instance - discovers skills from the skills/ directory.
 */
export const skills = new Skills({
  id: 'demo-skills',
  paths: [resolveSkillsPath()],
});
