export type { Skill, SkillMetadata } from '../../workspace/skills/types';

export type SkillSource = 'configured' | 'workspace';

/**
 * Thrown by `session.useSkill` when the named skill is not present in any
 * configured source.
 */
export class HarnessSkillNotFoundError extends Error {
  readonly name = 'HarnessSkillNotFoundError';
  readonly skillName: string;
  readonly searchedSources: readonly SkillSource[];

  constructor(opts: { name: string; searchedSources: readonly SkillSource[] }) {
    super(`Harness skill not found: ${opts.name} (searched: ${opts.searchedSources.join(', ') || 'none'})`);
    this.skillName = opts.name;
    this.searchedSources = opts.searchedSources;
  }
}
