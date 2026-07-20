import type { SkillMetadata } from '@mastra/core/workspace';

/**
 * Whether a skill should be invocable directly by the user via /skill/<name>
 * and surfaced in the /skills listing and autocomplete. Defaults to true.
 * Skills opt out by setting `user-invocable: false` in SKILL.md frontmatter.
 */
export function isUserInvocable(skill: Pick<SkillMetadata, 'user-invocable'>): boolean {
  return skill['user-invocable'] !== false;
}
