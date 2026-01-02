import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Skills } from '@mastra/skills';

/**
 * Resolve skills path - works from both project root and .mastra/output/
 */
function resolveSkillsPath(): string {
  // Try project root first (for demo scripts)
  const fromRoot = resolve(process.cwd(), 'skills');
  if (existsSync(fromRoot)) {
    return fromRoot;
  }

  // Try from .mastra/output/ (for mastra dev)
  const fromOutput = resolve(process.cwd(), '../../skills');
  if (existsSync(fromOutput)) {
    return fromOutput;
  }

  // Fallback to project root path (will error if not found)
  return fromRoot;
}

/**
 * Skills instance - discovers skills from the skills/ directory.
 */
export const skills = new Skills({
  id: 'demo-skills',
  paths: [resolveSkillsPath()],
});
