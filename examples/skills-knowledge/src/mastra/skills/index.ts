import { Skills } from '@mastra/skills';

/**
 * Skills instance - discovers skills from the skills/ directory.
 */
export const skills = new Skills({
  id: 'demo-skills',
  paths: ['./skills'],
});
