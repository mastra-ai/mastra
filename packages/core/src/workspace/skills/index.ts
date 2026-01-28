/**
 * Skills Module
 *
 * Provides types, schemas, and implementation for Skills following the Agent Skills specification.
 * Skills are SKILL.md files discovered from workspace skills paths.
 *
 * @see https://github.com/anthropics/skills
 */

export * from './types';
export * from './schemas';

// skill-source has a rename (SkillSource as SkillFileSource) so can't use wildcard
export type { SkillSource as SkillFileSource, SkillSourceStat, SkillSourceEntry } from './skill-source';
export { isWritableSource } from './skill-source';

export * from './local-skill-source';
export * from './workspace-skills';
