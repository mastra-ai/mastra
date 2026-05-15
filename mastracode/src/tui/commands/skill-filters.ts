import type { SkillMetadata } from '@mastra/core/workspace';

/**
 * Whether a skill should be invokable directly by the user via /skill/<name>
 * and surfaced in the /skills listing and autocomplete. Defaults to true.
 * Skills opt out by setting `metadata.userInvokable: false` in frontmatter.
 */
export function isUserInvokable(skill: Pick<SkillMetadata, 'metadata'>): boolean {
  return skill.metadata?.userInvokable !== false;
}
